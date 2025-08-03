# Simplified Twilio Audio Transcription Setup

This is a simplified version of your Twilio audio streaming and transcription setup, based on the official Twilio reference implementation.

## Features

- ✅ Receives audio streams from Twilio via WebSocket
- ✅ Transcribes audio in real-time using Google Cloud Speech API  
- ✅ Logs transcriptions to console for testing
- ✅ Simple TwiML endpoint for Twilio webhook configuration
- ✅ Handles multiple audio tracks
- ✅ Automatic stream management (60-second timeout)

## Setup

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Set up Google Cloud Speech API:**
   - Create a Google Cloud project
   - Enable the Speech-to-Text API
   - Create a service account and download the JSON key file
   - Set the `GOOGLE_APPLICATION_CREDENTIALS` environment variable:
     ```bash
     export GOOGLE_APPLICATION_CREDENTIALS=/path/to/your/service-account-key.json
     ```

3. **Build and start the server:**
   ```bash
   npm run build
   npm run dev
   ```

4. **Set up ngrok for public access:**
   ```bash
   ngrok http 8080
   ```

5. **Update the TwiML template:**
   - Edit `templates/streams.xml`
   - Replace `wss://your-ngrok-url.ngrok.io/` with your actual ngrok WebSocket URL

6. **Configure Twilio webhook:**
   - In your Twilio Console, set the webhook URL to: `https://your-ngrok-url.ngrok.io/twiml`

## Endpoints

- **WebSocket**: `ws://localhost:8080` - Receives Twilio media streams
- **TwiML**: `http://localhost:8080/twiml` - Returns TwiML for Twilio webhook

## Testing

1. Make sure the server is running and accessible via ngrok
2. Configure a Twilio phone number to use your webhook URL
3. Make a call to your Twilio number
4. Watch the console for real-time transcriptions:
   ```
   🎯 Transcription (inbound): Hello, this is a test call
   ```

## Differences from your complex setup

- Uses Google Cloud Speech API instead of OpenAI
- Single WebSocket server instead of proxy architecture
- No database integration (just console logging)
- No bot client support
- Simplified message handling
- Based on proven Twilio reference implementation

## Next Steps

Once this basic setup is working, you can:
- Switch back to OpenAI transcription if preferred
- Add database logging
- Implement your bot integration
- Add webhook notifications