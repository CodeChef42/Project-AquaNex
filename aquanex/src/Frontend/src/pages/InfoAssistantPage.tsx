import { useState } from "react";
import { Bot } from "lucide-react";
import Breadcrumbs from "@/components/Breadcrumbs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import api from "@/lib/api";

const InfoAssistantPage = () => {
  const [chatInput, setChatInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const [chatMessages, setChatMessages] = useState<Array<{ role: "assistant" | "user"; content: string }>>([
    { role: "assistant", content: "Hi! Ask me where to go in AquaNex and I’ll guide you quickly." },
  ]);

  const sendChat = async () => {
    const question = chatInput.trim();
    if (!question || chatLoading) return;
    setChatMessages((prev) => [...prev, { role: "user", content: question }]);
    setChatInput("");
    setChatLoading(true);
    try {
      const response = await api.post("/info/assistant/", { question });
      const reply = String(response?.data?.reply || "").trim() || "I could not generate guidance right now.";
      setChatMessages((prev) => [...prev, { role: "assistant", content: reply }]);
    } catch {
      setChatMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content:
            "Open /home for overview, /settings for configuration, /pipeline for leaks, /water-quality for pH/turbidity, /soil-salinity for EC, and /demand-forecasting for planning.",
        },
      ]);
    } finally {
      setChatLoading(false);
    }
  };

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <Breadcrumbs items={[{ label: "Information", path: "/info" }, { label: "AI Navigation Help" }]} />
      <Card className="border-cyan-100 bg-white/50 backdrop-blur-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Bot className="w-5 h-5 text-violet-600" />
            AI Navigation Help
          </CardTitle>
          <CardDescription>Ask Groq AI where to go and what to do inside AquaNex pages.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="h-[60vh] min-h-[360px] overflow-y-auto rounded-lg border p-3 bg-muted/20 space-y-2">
            {chatMessages.map((msg, idx) => (
              <div
                key={`${msg.role}-${idx}`}
                className={`rounded-lg p-2 text-sm ${msg.role === "user" ? "bg-primary/10 ml-4" : "bg-card mr-4"}`}
              >
                {msg.content}
              </div>
            ))}
            {chatLoading && <p className="text-xs text-muted-foreground">Thinking...</p>}
          </div>
          <div className="flex gap-2">
            <Input
              placeholder="Ask: why does pipeline show scan devices? where to configure modules?"
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") void sendChat();
              }}
            />
            <Button onClick={sendChat} disabled={chatLoading || !chatInput.trim()}>
              Send
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default InfoAssistantPage;
