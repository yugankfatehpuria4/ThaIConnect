import twilio from "twilio";

// Read from process.env since api.ts (the entry point) handles 'dotenv/config'
const twilioSid = process.env.TWILIO_SID || "dummy_sid";
const twilioAuth = process.env.TWILIO_AUTH || "dummy_auth";
const twilioPhone = process.env.TWILIO_PHONE || "+10000000000";

let client: twilio.Twilio | null = null;

try {
  // Only initialize if we actually have credentials, to avoid throwing on boot
  if (twilioSid !== "dummy_sid" && twilioAuth !== "dummy_auth") {
    client = twilio(twilioSid, twilioAuth);
  }
} catch (error) {
  console.warn("Twilio client initialization skipped or failed. Using mock.");
}

export const sendSMS = async (phone: string, message: string) => {
  if (!client || twilioSid === "dummy_sid") {
    console.log(`[MOCK SMS to ${phone}]: ${message}`);
    return;
  }
  try {
    await client.messages.create({
      body: message,
      from: twilioPhone,
      to: phone,
    });
  } catch (err: any) {
    console.error("SMS Error:", err.message);
  }
};

export const sendWhatsApp = async (phone: string, message: string) => {
  if (!client || twilioSid === "dummy_sid") {
    console.log(`[MOCK WhatsApp to ${phone}]: ${message}`);
    return;
  }
  try {
    await client.messages.create({
      body: message,
      from: "whatsapp:+14155238886",
      to: `whatsapp:${phone}`,
    });
  } catch (err: any) {
    console.error("WhatsApp Error:", err.message);
  }
};
