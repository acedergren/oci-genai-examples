import { oci, getSupportedLanguages } from "@acedergren/oci-genai-provider";
import { transcribe } from "ai";
import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function main() {
  console.log("🌍 Multilingual Speech-to-Text Demo
");

  const languages = getSupportedLanguages();
  console.log(`📋 Supported Languages (${languages.length}):`);
  console.log(languages.join(", "));
  console.log();

  const examples = [
    { lang: "en-US", file: "english-sample.wav", name: "English (US)" },
    { lang: "es-ES", file: "spanish-sample.wav", name: "Spanish" },
    { lang: "de-DE", file: "german-sample.wav", name: "German" },
    { lang: "ja-JP", file: "japanese-sample.wav", name: "Japanese" },
  ];

  console.log("🎙️  Transcribing multiple languages...
");

  for (const example of examples) {
    try {
      console.log(`${example.name} (${example.lang}):`);

      const audioData = readFileSync(join(__dirname, example.file));

      const model = oci.transcriptionModel("oci.speech.whisper", {
        language: example.lang,
      });

      const { text } = await transcribe({
        model,
        audioData,
      });

      console.log(`  ✅ "${text}"
`);
    } catch (error: any) {
      console.log(`  ⚠️  Skipped (file not found)
`);
    }
  }

  console.log("✅ Demo complete\!");
}

main().catch(console.error);
