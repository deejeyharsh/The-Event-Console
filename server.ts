import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import fetch from 'node-fetch';
import fs from 'fs';
import { initializeApp } from 'firebase/app';
import { getFirestore, doc, updateDoc, collectionGroup, collection, query, where, getDocs, limit } from 'firebase/firestore';

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));

let db: any;
try {
  const firebaseConfig = JSON.parse(fs.readFileSync('./firebase-applet-config.json', 'utf8'));
  const firebaseApp = initializeApp(firebaseConfig);
  db = getFirestore(firebaseApp, firebaseConfig.firestoreDatabaseId);
} catch (e) {
  console.error("Failed to initialize Firebase in server:", e);
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // API Routes
  app.get('/api/test', (req, res) => {
    res.json({ message: 'Server is working' });
  });

  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok' });
  });

  // Get WhatsApp Config (to check if enabled)
  app.get('/api/whatsapp/config', (req, res) => {
    console.log('GET /api/whatsapp/config hit');
    res.json({
      enabled: !!(process.env.WHATSAPP_BUSINESS_TOKEN && process.env.WHATSAPP_PHONE_NUMBER_ID),
    });
  });

  // Send WhatsApp via Business API
  app.post('/api/whatsapp/send', async (req, res) => {
    const { to, message, templateName, components, type, buttons, weddingId, guestId, attachmentUrl, attachmentType } = req.body;
    const token = process.env.WHATSAPP_BUSINESS_TOKEN;
    const phoneId = process.env.WHATSAPP_PHONE_NUMBER_ID;

    if (!token || !phoneId) {
      return res.status(400).json({ error: 'WhatsApp Business API not configured' });
    }

    try {
      let payload: any = {
        messaging_product: 'whatsapp',
        to,
      };

      if (type === 'interactive' && buttons && buttons.length > 0) {
        payload.type = 'interactive';
        payload.interactive = {
          type: 'button',
          body: { text: message },
          action: {
            buttons: buttons.map((label: string, index: number) => ({
              type: 'reply',
              reply: {
                id: (weddingId && guestId) ? `__rsvp__${weddingId}__${guestId}__${label.substring(0, 20)}` : `btn_${index + 1}`,
                title: label.substring(0, 20)
              }
            }))
          }
        };
        if (attachmentUrl) {
          payload.interactive.header = {
            type: attachmentType === 'document' ? 'document' : 'image',
            [attachmentType === 'document' ? 'document' : 'image']: {
              link: attachmentUrl,
              ...(attachmentType === 'document' ? { filename: 'attachment.pdf' } : {})
            }
          };
        }
      } else if (templateName) {
        payload.type = 'template';
        payload.template = {
          name: templateName,
          language: { code: 'en_US' },
          components: components || [],
        };
      } else {
        if (attachmentUrl) {
          const typeKey = attachmentType === 'document' ? 'document' : 'image';
          payload.type = typeKey;
          payload[typeKey] = {
            link: attachmentUrl,
            caption: message,
            ...(typeKey === 'document' ? { filename: 'attachment.pdf' } : {})
          };
        } else {
          payload.type = 'text';
          payload.text = { body: message };
        }
      }

      const response = await fetch(`https://graph.facebook.com/v17.0/${phoneId}/messages`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      const data = await response.json() as any;
      if (!response.ok) {
        throw new Error(data.error?.message || 'Failed to send WhatsApp message');
      }

      res.json({ success: true, data });
    } catch (error: any) {
      console.error('WhatsApp API Error:', error);
      res.status(500).json({ error: error?.message || 'Internal Server Error' });
    }
  });

  // CheckIn Proxy Endpoint (bypassing client-side list auth rules)
  app.post('/api/checkin', async (req, res) => {
    try {
      const { weddingId, phone } = req.body;
      if (!weddingId || !phone) return res.status(400).json({ error: 'Missing parameters' });
      
      const guestsRef = collection(db, `weddings/${weddingId}/guests`);
      const q = query(guestsRef, where('phone', '==', phone.trim()), limit(2));
      let snapshot = await getDocs(q);
      
      let guestDoc = snapshot.docs[0];
      
      if (!guestDoc) {
         const numericOnly = phone.replace(/\D/g,'');
         if (numericOnly) {
           const q2 = query(guestsRef, where('phone', '==', numericOnly), limit(2));
           const snapshot2 = await getDocs(q2);
           guestDoc = snapshot2.docs[0];
         }
      }
      
      if (!guestDoc) {
        return res.status(404).json({ error: 'Guest not found' });
      }
      
      const guestData = guestDoc.data();
      if (guestData.attendanceStatus === 'ARRIVED') {
        return res.json({ success: true, alreadyCheckedIn: true, data: guestData });
      }
      
      await updateDoc(guestDoc.ref, {
        attendanceStatus: 'ARRIVED',
        checkInTime: new Date().toISOString()
      });
      guestData.attendanceStatus = 'ARRIVED';
      
      res.json({ success: true, data: guestData, guestId: guestDoc.id });
    } catch (e: any) {
      console.error('Checkin API error:', e);
      res.status(500).json({ error: e.message });
    }
  });

  // Webhook for WhatsApp (Status Updates, etc.)
  app.get('/api/whatsapp/webhook', (req, res) => {
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];

    if (mode && token) {
      if (mode === 'subscribe' && token === process.env.WHATSAPP_VERIFY_TOKEN) {
        console.log('WEBHOOK_VERIFIED');
        res.status(200).send(challenge);
      } else {
        res.sendStatus(403);
      }
    }
  });

  app.post('/api/whatsapp/webhook', async (req, res) => {
    const body = req.body;

    if (body.object === 'whatsapp_business_account') {
      try {
        const changes = body.entry?.[0]?.changes?.[0]?.value;
        const message = changes?.messages?.[0];

        if (message && message.type === 'interactive' && message.interactive?.type === 'button_reply') {
          const replyId = message.interactive.button_reply.id;
          const replyTitle = message.interactive.button_reply.title;

          if (db && replyId.startsWith('__rsvp__')) {
            const parts = replyId.split('__');
            if (parts.length >= 4) {
              const weddingId = parts[2];
              const guestId = parts[3];

              // Determine RSVP Status based on the button title. We map common responses.
              const lowerTitle = replyTitle.toLowerCase();
              let newRsvpStatus = 'pending';
              if (lowerTitle.includes('yes') || lowerTitle.includes('coming') || lowerTitle.includes('in') || lowerTitle.includes('attending')) {
                newRsvpStatus = 'yes';
              } else if (lowerTitle.includes('no') || lowerTitle.includes('sorry') || lowerTitle.includes('can\'t') || lowerTitle.includes('cannot') || lowerTitle.includes('not')) {
                newRsvpStatus = 'no';
              } else {
                newRsvpStatus = 'maybe';
              }

              console.log(`Updating RSVP for guest ${guestId} in wedding ${weddingId} to ${newRsvpStatus}`);
              
              await updateDoc(doc(db, `weddings/${weddingId}/guests`, guestId), {
                rsvpStatus: newRsvpStatus,
                updatedAt: new Date().toISOString()
              });
            }
          }
        } else if (message && message.type === 'text') {
          const textBody = message.text?.body?.trim().toLowerCase();
          const fromPhone = message.from; // Phone number from WhatsApp, usually e.g., 919876543210

          if (textBody && db && fromPhone) {
            let newRsvpStatus = null;
            if (textBody === '1' || textBody.includes('yes') || textBody.includes('attending') || textBody.includes('coming') || textBody.includes('in')) {
              newRsvpStatus = 'yes';
            } else if (textBody === '2' || textBody.includes('no') || textBody.includes('not attending') || textBody.includes('sorry') || textBody.includes('cannot') || textBody.includes("can't")) {
              newRsvpStatus = 'no';
            } else if (textBody === '3' || textBody.includes('maybe') || textBody.includes('not sure')) {
              newRsvpStatus = 'maybe';
            }

            if (newRsvpStatus) {
              // Try to find the guest by phone number.
              // WhatsApp 'from' is missing the '+' and may lack formatting. 
              // We'll search for exact matches or normalized matches if possible, but Firestore requires exact matches.
              const possiblePhones = [
                fromPhone, 
                `+${fromPhone}`, 
                fromPhone.length > 10 ? fromPhone.substring(fromPhone.length - 10) : fromPhone
              ];

              const uniquePhones = [...new Set(possiblePhones)];
              const guestsSnapshot = await getDocs(query(collectionGroup(db, 'guests'), where('phone', 'in', uniquePhones)));

              if (!guestsSnapshot.empty) {
                for (const guestDoc of guestsSnapshot.docs) {
                  const guestData = guestDoc.data();
                  const guestId = guestDoc.id;
                  const weddingId = guestData.weddingId;
                  
                  if (weddingId) {
                    console.log(`Updating RSVP via text reply for guest ${guestId} in wedding ${weddingId} to ${newRsvpStatus}`);
                    await updateDoc(doc(db, `weddings/${weddingId}/guests`, guestId), {
                      rsvpStatus: newRsvpStatus,
                      updatedAt: new Date().toISOString()
                    });
                  }
                }
              }
            }
          }
        }

        res.status(200).send('EVENT_RECEIVED');
      } catch (e) {
        console.error('Webhook payload error:', e);
        res.sendStatus(500);
      }
    } else {
      res.sendStatus(404);
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
