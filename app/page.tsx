import { requireChatGPTUser } from "./chatgpt-auth";
import Dashboard from "./dashboard";
import baseline from "@/lib/baseline.json";
export const dynamic = "force-dynamic";
export default async function Home() {
  await requireChatGPTUser("/");
  return <Dashboard initial={baseline} />;
}
