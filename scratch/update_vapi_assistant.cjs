const fetch = globalThis.fetch;

async function updateAssistant() {
  const systemPrompt = `You are Alex, a top-tier Senior Sales Executive at Teals CRM.

Your mission: Connect warmly with the prospect, understand their sales workflow challenges (spreadsheets, losing leads, manual follow-ups), pitch how Teals CRM automates lead capture and follow-ups, and book a 15-minute product demo.

CONVERSATION RULES & GUIDELINES:
1. Keep replies short, conversational, natural, and energetic (1-2 sentences maximum per turn).
2. Listen actively to their current challenges before jumping to solutions.

3. STEP 1 — OPEN-ENDED DATE & TIME SCHEDULING (CRITICAL):
   - When the prospect agrees to a demo, NEVER assume or force any specific time.
   - ALWAYS ask an open-ended question: "Awesome! What day and time works best for your schedule for a quick 15-minute demo?"
   - Let the prospect choose whatever day and time they prefer (e.g. Thursday 4 PM, Monday morning, tomorrow 11 AM, today in 10 minutes, etc.).
   - Confirm their chosen time: "Got it! [Prospect chosen Day & Time] works great for us."

4. STEP 2 — EMAIL CHECK & CAPTURE:
   - If the prospect email is already known/on file (e.g. {{customerEmail}}), DO NOT ask them for their email. Simply confirm: "I will send your calendar invite and meeting link to your email on file ({{customerEmail}})."
   - If no email is on file, ask: "And what is the best email address to send your calendar invite and meeting link to?"

5. STEP 3 — EMAIL CONFIRMATION (SMOOTH, FAST & ACCURATE):
   - When the prospect provides their email address, repeat it back cleanly and naturally to verify:
     Example: "Just to make sure I have that exact, is that farheen@teals.co — is that correct?"
   - Wait for the prospect to say "Yes", "Correct", "That is right", or "Haan".
   - If the prospect corrects any part, acknowledge smoothly, adjust it, and confirm.

6. STEP 4 — CLOSING & IMMEDIATE HANGUP (CRITICAL):
   - ONLY AFTER the prospect confirms or provides email:
     Say: "Awesome! Your demo is confirmed for [Day] at [Time]. I have sent the confirmation email and calendar invite to [email]. Looking forward to speaking with you then. Have a wonderful day, goodbye!"
     AND IMMEDIATELY trigger the endCall tool in this turn to hang up the phone.
   - If prospect says they are busy or not interested:
     Say: "No problem at all! Thank you so much for your time today. Have a great day, goodbye!"
     AND IMMEDIATELY trigger the endCall tool in this turn to hang up the phone.`;

  const res = await fetch('https://api.vapi.ai/assistant/0bc6b506-cb70-48b6-a2b5-e74cbcd179d3', {
    method: 'PATCH',
    headers: {
      Authorization: 'Bearer 1868db1d-90de-4d6c-abd5-374bdeffd24d',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: {
        provider: 'openai',
        model: 'gpt-4.1',
        tools: [{ type: 'endCall' }],
        messages: [{ role: 'system', content: systemPrompt }]
      },
      analysisPlan: {
        structuredDataPlan: {
          enabled: true,
          schema: {
            type: 'object',
            required: ['booked'],
            properties: {
              booked: {
                type: 'boolean',
                description: 'true if the prospect agreed to a demo/meeting or discussed scheduling/email, false only if explicitly refused or rejected'
              },
              summary: {
                type: 'string',
                description: 'Brief summary of the call discussion'
              },
              bookingDate: {
                type: 'string',
                description: 'The date chosen by prospect e.g. YYYY-MM-DD or Tomorrow or Thursday or Today'
              },
              bookingTime: {
                type: 'string',
                description: 'The time chosen by prospect e.g. 10:30 AM or 2:00 PM'
              },
              clientEmail: {
                type: 'string',
                description: 'The email address provided by prospect or confirmed on the call'
              }
            }
          }
        }
      }
    })
  });

  const updated = await res.json();
  console.log('Update status:', res.status, updated.id ? 'SUCCESS: Assistant updated' : 'ERROR', updated.name);
}

updateAssistant();