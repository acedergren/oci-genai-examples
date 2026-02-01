import { oci } from '@acedergren/oci-genai-provider';
import { experimental_transcribe as transcribe } from 'ai';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function main() {
  // OCI Speech services are currently constrained to specific regions like us-phoenix-1
  if (process.env.OCI_REGION && process.env.OCI_REGION !== 'us-phoenix-1') {
    console.warn(`⚠️  Warning: OCI Speech services are region-constrained.
   Your current region is set to '${process.env.OCI_REGION}'.
   If you encounter 404/400 errors, try setting OCI_REGION=us-phoenix-1\n`);
  }

  console.log('🎙️  OCI Speech-to-Text Demo\n');

  const audioPath = process.argv[2] || join(__dirname, 'sample-audio.wav');

  console.log(`📁 Loading audio: ${audioPath}`);

  let audioData: Uint8Array;
  try {
    audioData = readFileSync(audioPath);
  } catch (error) {
    console.error('❌ Error loading audio file:', error);
    console.log('\nUsage: pnpm start [path-to-audio-file.wav]');
    process.exit(1);
  }

  console.log(`   Size: ${(audioData.byteLength / 1024).toFixed(1)} KB\n`);

  console.log('🔹 Using model: oci.speech.standard');
  console.log('🌍 Language: en-US\n');

  const transcriptionModel = oci.transcriptionModel('oci.speech.standard', {
    language: 'en-US',
    vocabulary: ['OpenCode', 'GenAI', 'OCI', 'Oracle'],
  });

  console.log('⏳ Transcribing audio...');
  console.log('   (This may take 30-60 seconds)\n');

  const startTime = Date.now();

  const { text, language } = await transcribe({
    model: transcriptionModel,
    audio: audioData,
  });

  const duration = ((Date.now() - startTime) / 1000).toFixed(1);

  console.log('✅ Transcription complete!\n');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('📝 TRANSCRIPT:');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  console.log(text);
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`\n📊 Language: ${language}`);
  console.log(`⏱️  Duration: ${duration}s`);
}

main().catch((error) => {
  console.error('❌ Error:', error.message);
  process.exit(1);
});
