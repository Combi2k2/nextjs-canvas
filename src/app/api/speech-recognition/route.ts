// Server-side API endpoint for Google Cloud Speech API
// App Router format for Next.js 15

import { NextRequest, NextResponse } from 'next/server';
import { SpeechClient } from '@google-cloud/speech';

// Initialize Google Cloud Speech client
const speechClient = new SpeechClient({
  // Add your Google Cloud credentials here
  // You can use environment variables or service account key
  keyFilename: process.env.GOOGLE_CLOUD_KEY_FILE,
  // Or use application default credentials
  // credentials: JSON.parse(process.env.GOOGLE_CLOUD_CREDENTIALS || '{}')
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { audio, apiKey } = body;
    
    if (!audio) {
      return NextResponse.json({ error: 'No audio data provided' }, { status: 400 });
    }

    // Verify API key if needed
    if (process.env.SPEECH_API_KEY && apiKey !== process.env.SPEECH_API_KEY) {
      return NextResponse.json({ error: 'Invalid API key' }, { status: 401 });
    }

    // Configure the request
    const speechRequest = {
      config: {
        encoding: 'WEBM_OPUS' as const,
        sampleRateHertz: 16000,
        languageCode: 'en-US',
        alternativeLanguageCodes: ['es-ES', 'fr-FR'],
        enableAutomaticPunctuation: true,
        model: 'latest_long',
      },
      audio: {
        content: audio.toString('base64'),
      },
    };

    // Perform the speech recognition
    const [response] = await speechClient.recognize(speechRequest);
    
    const transcription = response.results
      ?.map(result => result.alternatives?.[0]?.transcript)
      .filter(Boolean)
      .join(' ') || '';

    return NextResponse.json({
      transcript: transcription,
      confidence: response.results?.[0]?.alternatives?.[0]?.confidence || 0
    });

  } catch (error) {
    console.error('Speech recognition error:', error);
    return NextResponse.json({ 
      error: 'Speech recognition failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

// For streaming recognition (more advanced)
export const createStreamingRecognition = () => {
  const request = {
    config: {
      encoding: 'WEBM_OPUS' as const,
      sampleRateHertz: 16000,
      languageCode: 'en-US',
      enableAutomaticPunctuation: true,
      model: 'latest_long',
    },
    interimResults: true,
  };

  return speechClient.streamingRecognize(request)
    .on('error', (error) => {
      console.error('Streaming recognition error:', error);
    })
    .on('data', (data) => {
      const result = data.results?.[0];
      if (result?.alternatives?.[0]) {
        const transcript = result.alternatives[0].transcript;
        const isFinal = result.isFinal;
        
        // Emit the result (you'd need to implement proper event handling)
        console.log(`${isFinal ? 'Final' : 'Interim'}: ${transcript}`);
      }
    });
};
