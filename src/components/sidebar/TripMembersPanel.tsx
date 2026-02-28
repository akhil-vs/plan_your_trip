"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Link2, Loader2, UserPlus, UserX } from "lucide-react";

type MemberRole = "OWNER" | "EDITOR" | "VIEWER";

interface MemberItem {
  id: string;
  role: MemberRole;
  user: { id: string; name: string; email: string };
}

interface InviteItem {
  id: string;
  email: string;
  token: string;
  role: MemberRole;
  status: "PENDING" | "ACCEPTED" | "REVOKED" | "EXPIRED";
}

interface InviteCreateResponse extends InviteItem {
  emailDelivered?: boolean;
  emailWarning?: string | null;
}

interface TripMembersPanelProps {
  tripId: string;
  canManage: boolean;
}

export function TripMembersPanel({ tripId, canManage }: TripMembersPanelProps) {
  const [members, setMembers] = useState<MemberItem[]>([]);
  const [invites, setInvites] = useState<InviteItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<MemberRole>("EDITOR");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [copiedInviteId, setCopiedInviteId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [membersRes, invitesRes] = await Promise.all([
        fetch(`/api/trips/${tripId}/members`),
        fetch(`/api/trips/${tripId}/invites`),
      ]);
      if (membersRes.ok) {
        const data = await membersRes.json();
        setMembers(Array.isArray(data) ? data : []);
      }
      if (invitesRes.ok) {
        const data = await invitesRes.json();
        setInvites(Array.isArray(data) ? data : []);
      }
    } finally {
      setLoading(false);
    }
  }, [tripId]);

  useEffect(() => {
    void load();
  }, [load]);

  const inviteMember = async () => {
    if (!canManage || !email.trim()) return;
    setError("");
    setNotice("");
    const res = await fetch(`/api/trips/${tripId}/invites`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: email.trim(), role }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => null);
      setError(data?.error || "Failed to send invite");
      return;
    }
    const data = (await res.json()) as InviteCreateResponse;
    if (data.emailDelivered) {
      setNotice("Invite sent by email.");
    } else {
      setNotice("Invite created. Email delivery unavailable; share the invite link.");
    }
    setEmail("");
    await load();
  };

  const removeMember = async (userId: string) => {
    if (!canManage) return;
    await fetch(`/api/trips/${tripId}/members`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId }),
    });
    await load();
  };

  const revokeInvite = async (inviteId: string) => {
    if (!canManage) return;
    await fetch(`/api/trips/${tripId}/invites`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ inviteId }),
    });
    await load();
  };

  const copyInviteLink = async (invite: InviteItem) => {
    if (typeof window === "undefined") return;
    const inviteUrl = `${window.location.origin}/invite/${invite.token}`;
    await navigator.clipboard.writeText(inviteUrl);
    setCopiedInviteId(invite.id);
    setTimeout(() => setCopiedInviteId(null), 1800);
  };

  return (
    <div className="space-y-3">
      <div className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Members
        </p>
        {loading ? (
          <div className="text-xs text-muted-foreground flex items-center gap-2">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            Loading members...
          </div>
        ) : members.length === 0 ? (
          <p className="text-xs text-muted-foreground">No members yet.</p>
        ) : (
          <div className="space-y-1.5">
            {members.map((member) => (
              <div
                key={member.id}
                className="rounded border px-2 py-1.5 flex items-center gap-2"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-medium truncate">{member.user.name}</p>
                  <p className="text-[11px] text-muted-foreground truncate">
                    {member.user.email}
                  </p>
                </div>
                <Badge variant="secondary" className="text-[10px]">
                  {member.role}
                </Badge>
                {canManage && member.role !== "OWNER" && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-red-500"
                    onClick={() => removeMember(member.user.id)}
                  >
                    <UserX className="h-3.5 w-3.5" />
                  </Button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {canManage && (
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Invite Collaborator
          </p>
          <Input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="email@example.com"
            className="h-8 text-xs"
          />
          <div className="flex items-center gap-2">
            <select
              className="h-8 rounded-md border px-2 text-xs bg-background"
              value={role}
              onChange={(e) => setRole(e.target.value as MemberRole)}
            >
              <option value="EDITOR">Editor</option>
              <option value="VIEWER">Viewer</option>
            </select>
            <Button size="sm" className="gap-1.5" onClick={inviteMember}>
              <UserPlus className="h-3.5 w-3.5" />
              Send invite
            </Button>
          </div>
          {error && <p className="text-[11px] text-red-500">{error}</p>}
          {notice && <p className="text-[11px] text-emerald-600">{notice}</p>}
        </div>
      )}

      <div className="space-y-1">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Pending Invites
        </p>
        {invites.filter((i) => i.status === "PENDING").length === 0 ? (
          <p className="text-xs text-muted-foreground">No pending invites.</p>
        ) : (
          invites
            .filter((invite) => invite.status === "PENDING")
            .map((invite) => (
              <div
                key={invite.id}
                className="rounded border px-2 py-1.5 flex items-center gap-2"
              >
                <p className="text-xs flex-1 truncate">{invite.email}</p>
                <Badge variant="outline" className="text-[10px]">
                  {invite.role}
                </Badge>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={() => copyInviteLink(invite)}
                  title="Copy invite link"
                >
                  <Link2 className="h-3.5 w-3.5" />
                </Button>
                {canManage && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-red-500"
                    onClick={() => revokeInvite(invite.id)}
                  >
                    <UserX className="h-3.5 w-3.5" />
                  </Button>
                )}
              </div>
            ))
        )}
        {copiedInviteId && <p className="text-[11px] text-green-600">Invite link copied to clipboard.</p>}
      </div>
    </div>
  );
}
