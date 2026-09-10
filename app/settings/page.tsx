import { requireChatGPTUser } from "../chatgpt-auth";
import Integrations from "./integrations";
export const dynamic="force-dynamic";
export default async function SettingsPage(){await requireChatGPTUser("/settings");return <Integrations/>;}
