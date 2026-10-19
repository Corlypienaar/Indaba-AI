import { getQuestions } from "@/lib/content";
import Chat from "./chat";

// Server component: reads the interview questions out of content/prompts.md
// at build time and hands them to the chat screen. Editing content/prompts.md
// on GitHub triggers a fresh Vercel build, so the questions stay in sync.

export default function Page() {
  const questions = getQuestions();
  return <Chat questions={questions} />;
}
