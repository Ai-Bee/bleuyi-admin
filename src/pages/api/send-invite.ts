import type { NextApiRequest, NextApiResponse } from 'next';
import { Resend } from 'resend';
import { createClient } from '@supabase/supabase-js';
import QRCode from 'qrcode';


const resend = new Resend(process.env.NEXT_RESEND_API_KEY);
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { id, name, email } = req.body;

  if (!id || !name || !email) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  try {
    // Create QR data and image
    const qrData = `wedding-attendee:${id}`;
    const qrImageDataURL = await QRCode.toDataURL(qrData);
    // Extract base64 image (without header)
    const base64Data = qrImageDataURL.split(',')[1];
    const buffer = Buffer.from(base64Data, 'base64');

    // Upload to Supabase storage
    const filePath = `qr/${id}.png`;
    const uploadResult = await supabase.storage
      .from('qr-codes')
      .upload(filePath, buffer, {
        contentType: 'image/png',
        upsert: true,
      });
    if (uploadResult.error) {
      console.error('[SUPABASE UPLOAD ERROR]', uploadResult.error);
      return res.status(500).json({ error: uploadResult.error.message || 'Failed to upload QR code to storage' });
    }

    // Get public URL
    const publicUrlResult = supabase
      .storage
      .from('qr-codes')
      .getPublicUrl(filePath);

    const qrCodeUrl = publicUrlResult.data?.publicUrl;

    if (!qrCodeUrl) {
      // console.error('[SUPABASE PUBLIC URL ERROR]', publicUrlResult);
      return res.status(500).json({ error: 'Failed to get public URL for QR code' });
    }

    // Save QR info in DB
    const updateResult = await supabase
      .from('attendees')
      .update({
        qr_code_data: qrCodeUrl,
      })
      .eq('id', id);

    if (updateResult.error) {
      console.error('[SUPABASE DB UPDATE ERROR]', updateResult.error);
      return res.status(500).json({ error: updateResult.error.message || 'Failed to update attendee with QR info' });
    }

    // Send email
    const emailResult = await resend.emails.send({
      from: 'Wedding RSVP <onboarding@resend.dev>',
      to: email,
      subject: 'You’re Invited – Your RSVP is Confirmed!',
      html: `
         <div style="max-width:500px;margin:0 auto;padding:32px 24px;background:#fff;border-radius:16px;border:1px solid #eee;font-family:'Georgia',serif;position:relative;">
          <div style="position:absolute;top:0;left:0;width:100%;height:100%;z-index:-1;opacity:0.08;background:url('https://png.pngtree.com/png-clipart/20230810/original/pngtree-watercolor-floral-clipart-pink-roses-png-image_10696436.png') no-repeat top left, url('https://png.pngtree.com/png-clipart/20230810/original/pngtree-watercolor-floral-clipart-pink-roses-png-image_10696436.png') no-repeat bottom right;background-size:160px,160px;"></div>
          <div style="text-align:center;margin-bottom:24px;">
            <div style="font-size:13px;letter-spacing:2px;color:#888;">TOGETHER WITH THEIR FAMILIES</div>
            <div style="font-size:2.1em;font-family:'Dancing Script',cursive;margin:18px 0 0 0;color:#222;">Blessing Mbre</div>
            <div style="font-size:1.1em;margin:0 0 8px 0;color:#888;">and</div>
            <div style="font-size:2.1em;font-family:'Dancing Script',cursive;margin:0 0 18px 0;color:#222;">Unyime Inyang</div>
            <div style="font-size:13px;letter-spacing:1px;color:#888;margin-bottom:18px;">REQUEST THE PLEASURE OF YOUR COMPANY<br/>AT THE CEREMONY OF THEIR WEDDING</div>
            <div style="display:flex;justify-content:center;align-items:center;gap:16px;margin-bottom:18px;">
              <div style="text-align:right;font-size:13px;color:#888;">SATURDAY</div>
              <div style="border:1px solid #eee;padding:8px 18px;border-radius:8px;">
                <div style="font-size:1.5em;font-weight:bold;color:#222;">15th</div>
                <div style="font-size:12px;color:#888;">NOVEMBER</div>
              </div>
              <div style="text-align:left;font-size:13px;color:#888;">2025</div>
            </div>
            <div style="font-size:13px;color:#888;margin-bottom:18px;">AT 2PM </div>
            <div style="font-size:13px;color:#888;margin-bottom:18px;">RED BARN RANCH,<br/>13045 MOUNTAIN HOUSE RD<br/>HOPLAND CA, 98556</div>
            <div style="font-size:13px;color:#888;font-style:italic;">Reception to Follow</div>
          </div>
          <div style="text-align:center;margin:32px 0 0 0;">
            <div style="font-size:15px;color:#222;margin-bottom:8px;">Show this QR code at the entrance:</div>
            <img src="${qrImageDataURL}" alt="QR Code" style="width:160px;height:160px;border-radius:12px;border:1px solid #eee;background:#fafafa;" />
            <div style="font-size:12px;color:#888;margin-top:8px;">If you lose this email, you can still be verified with your name or email.</div>
          </div>
        </div>
      `,
    });

    if (emailResult.error) {
      console.error('[RESEND EMAIL ERROR]', emailResult.error);
      return res.status(500).json({ error: emailResult.error.message || 'Failed to send email' });
    }

    // Optionally log the result for debugging
    console.log('[RESEND EMAIL SENT]', emailResult);
    return res.status(200).json({ success: true, sentEmail: email });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } catch (err: any) {
    console.error('[QR EMAIL ERROR]', err);
    return res.status(500).json({ error: err.message || 'Internal server error' });
  }
}
