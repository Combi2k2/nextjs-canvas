// Server-side API endpoint for Google Cloud Speech API
// This would go in pages/api/speech-recognition.ts or app/api/speech-recognition/route.ts

import { NextApiRequest, NextApiResponse } from 'next';
import { SpeechClient } from '@google-cloud/speech';

// Initialize Google Cloud Speech client
const speechClient = new SpeechClient({
  // Add your Google Cloud credentials here
  // You can use environment variables or service account key
  keyFilename: process.env.GOOGLE_CLOUD_KEY_FILE,
  // Or use application default credentials
  // credentials: JSON.parse(process.env.GOOGLE_CLOUD_CREDENTIALS || '{}')
});

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { audio, apiKey } = req.body;
    
    if (!audio) {
      return res.status(400).json({ error: 'No audio data provided' });
    }

    // Verify API key if needed
    if (process.env.SPEECH_API_KEY && apiKey !== process.env.SPEECH_API_KEY) {
      return res.status(401).json({ error: 'Invalid API key' });
    }

    // Configure the request
    const request = {
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
    const [response] = await speechClient.recognize(request);
    
    const transcription = response.results
      ?.map(result => result.alternatives?.[0]?.transcript)
      .filter(Boolean)
      .join(' ') || '';

    res.status(200).json({
      transcript: transcription,
      confidence: response.results?.[0]?.alternatives?.[0]?.confidence || 0
    });

  } catch (error) {
    console.error('Speech recognition error:', error);
    res.status(500).json({ 
      error: 'Speech recognition failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
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

