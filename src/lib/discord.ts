export interface DiscordBotIdentity {
  id: string;
  username: string;
}

export async function verifyDiscordBot(token: string): Promise<DiscordBotIdentity> {
  const res = await fetch("https://discord.com/api/v10/users/@me", {
    headers: { Authorization: `Bot ${token}` },
  });
  if (!res.ok) {
    const detail = res.status === 401 ? "Invalid bot token" : `Discord API returned ${res.status}`;
    throw new Error(detail);
  }
  const data = (await res.json()) as { id?: string; username?: string };
  if (!data.id || !data.username) throw new Error("Unexpected Discord API response");
  return { id: data.id, username: data.username };
}
