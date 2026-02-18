import type { Route } from "./+types/invite.group.$token";
import { useState } from "react";
import { useLoaderData, useNavigate, Link, useLocation } from "react-router";

interface LoaderData {
  status: "valid" | "expired" | "not_found" | "already_member" | "limit_reached" | "requires_login" | "email_mismatch";
  group?: {
    id: string;
    name: string;
    description: string | null;
  };
  invitedBy?: string;
  userEmail?: string;
  invitedEmail?: string;
  maxGroups: number;
}

export function meta({ data }: Route.MetaArgs) {
  const loaderData = data as LoaderData | undefined;
  if (loaderData?.group) {
    return [
      { title: `Join ${loaderData.group.name} - DnD` },
      { name: "description", content: `You've been invited to join ${loaderData.group.name}` },
    ];
  }
  return [
    { title: "Group Invitation - DnD" },
    { name: "description", content: "Group invitation" },
  ];
}

export async function loader({ request, params }: Route.LoaderArgs) {
  const { eq, and } = await import("drizzle-orm");
  const { db } = await import("~/.server/db");
  const { groupInvitations, groupMembers, groups, user } = await import("~/.server/db/schema");
  const { getSession } = await import("~/.server/auth/session");
  const { getUserGroupCount, MAX_GROUPS_PER_USER } = await import(
    "~/.server/permissions/group-permissions"
  );

  const { token } = params;

  // Get invitation
  const invitation = await db
    .select({
      id: groupInvitations.id,
      groupId: groupInvitations.groupId,
      email: groupInvitations.email,
      expiresAt: groupInvitations.expiresAt,
      invitedBy: groupInvitations.invitedBy,
    })
    .from(groupInvitations)
    .where(eq(groupInvitations.token, token))
    .limit(1);

  if (invitation.length === 0) {
    return Response.json({ status: "not_found", maxGroups: MAX_GROUPS_PER_USER } satisfies LoaderData);
  }

  const inv = invitation[0];

  // Check if expired
  if (new Date(inv.expiresAt) < new Date()) {
    return Response.json({ status: "expired", maxGroups: MAX_GROUPS_PER_USER } satisfies LoaderData);
  }

  // Get group details
  const groupData = await db
    .select({
      id: groups.id,
      name: groups.name,
      description: groups.description,
    })
    .from(groups)
    .where(eq(groups.id, inv.groupId))
    .limit(1);

  if (groupData.length === 0) {
    return Response.json({ status: "not_found", maxGroups: MAX_GROUPS_PER_USER } satisfies LoaderData);
  }

  const group = groupData[0];

  // Get inviter's name
  const inviter = await db
    .select({ name: user.name })
    .from(user)
    .where(eq(user.id, inv.invitedBy))
    .limit(1);

  // Check if user is logged in
  const session = await getSession(request);
  if (!session) {
    return Response.json({
      status: "requires_login",
      group,
      invitedBy: inviter[0]?.name,
      userEmail: inv.email,
      maxGroups: MAX_GROUPS_PER_USER,
    } satisfies LoaderData);
  }

  const userId = session.user.id;

  // Check if user is already a member
  const existingMember = await db
    .select()
    .from(groupMembers)
    .where(
      and(eq(groupMembers.groupId, group.id), eq(groupMembers.userId, userId))
    )
    .limit(1);

  if (existingMember.length > 0) {
    return Response.json({
      status: "already_member",
      group,
      maxGroups: MAX_GROUPS_PER_USER,
    } satisfies LoaderData);
  }

  // Check group limit
  const groupCount = await getUserGroupCount(userId);
  if (groupCount >= MAX_GROUPS_PER_USER) {
    return Response.json({
      status: "limit_reached",
      group,
      maxGroups: MAX_GROUPS_PER_USER,
    } satisfies LoaderData);
  }

  // Check email match
  const sessionEmail = session.user.email?.toLowerCase().trim();
  const invitedEmail = inv.email?.toLowerCase().trim();
  if (sessionEmail && invitedEmail && sessionEmail !== invitedEmail) {
    // Mask the invited email: show first 2 chars + "***" + domain
    const [localPart, domain] = invitedEmail.split("@");
    const masked = localPart.length > 2
      ? `${localPart.slice(0, 2)}***@${domain}`
      : `${localPart}***@${domain}`;

    return Response.json({
      status: "email_mismatch",
      group,
      invitedBy: inviter[0]?.name,
      invitedEmail: masked,
      maxGroups: MAX_GROUPS_PER_USER,
    } satisfies LoaderData);
  }

  return Response.json({
    status: "valid",
    group,
    invitedBy: inviter[0]?.name,
    maxGroups: MAX_GROUPS_PER_USER,
  } satisfies LoaderData);
}

export async function action({ request, params }: Route.ActionArgs) {
  const { eq, and } = await import("drizzle-orm");
  const { db } = await import("~/.server/db");
  const { groupInvitations, groupMembers } = await import("~/.server/db/schema");
  const { token } = params;

  // Handle decline (DELETE)
  if (request.method === "DELETE") {
    try {
      await db.delete(groupInvitations).where(eq(groupInvitations.token, token));
      return Response.json({ success: true });
    } catch (error) {
      console.error("Failed to decline invitation:", error);
      return Response.json({ error: "Failed to decline invitation" }, { status: 500 });
    }
  }

  if (request.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  const { getSession } = await import("~/.server/auth/session");
  const { getUserGroupCount, MAX_GROUPS_PER_USER } = await import(
    "~/.server/permissions/group-permissions"
  );
  const { nanoid } = await import("nanoid");

  // Get session - require login
  const session = await getSession(request);
  if (!session) {
    return Response.json({ error: "Please log in first" }, { status: 401 });
  }

  const userId = session.user.id;

  // Get invitation
  const invitation = await db
    .select()
    .from(groupInvitations)
    .where(eq(groupInvitations.token, token))
    .limit(1);

  if (invitation.length === 0) {
    return Response.json({ error: "Invitation not found" }, { status: 404 });
  }

  const inv = invitation[0];

  // Check if expired
  if (new Date(inv.expiresAt) < new Date()) {
    return Response.json({ error: "Invitation has expired" }, { status: 400 });
  }

  // Check email match
  const sessionEmail = session.user.email?.toLowerCase().trim();
  const invitedEmail = inv.email?.toLowerCase().trim();
  if (sessionEmail && invitedEmail && sessionEmail !== invitedEmail) {
    return Response.json(
      { error: "This invitation was sent to a different email address" },
      { status: 403 }
    );
  }

  // Check if already a member
  const existingMember = await db
    .select()
    .from(groupMembers)
    .where(
      and(eq(groupMembers.groupId, inv.groupId), eq(groupMembers.userId, userId))
    )
    .limit(1);

  if (existingMember.length > 0) {
    return Response.json({ error: "You are already a member of this group" }, { status: 400 });
  }

  // Check group limit
  const groupCount = await getUserGroupCount(userId);
  if (groupCount >= MAX_GROUPS_PER_USER) {
    return Response.json(
      { error: `You can only be a member of ${MAX_GROUPS_PER_USER} groups` },
      { status: 400 }
    );
  }

  // Add user to group and delete invitation
  // Note: Neon HTTP driver doesn't support transactions, so we do sequential operations
  try {
    await db.insert(groupMembers).values({
      id: nanoid(),
      groupId: inv.groupId,
      userId,
      role: "member",
      joinedAt: new Date(),
    });
  } catch (error) {
    console.error("Failed to add member to group:", error);
    return Response.json({ error: "Failed to accept invitation" }, { status: 500 });
  }

  // Delete invitation (non-fatal if this fails since user is already added)
  try {
    await db.delete(groupInvitations).where(eq(groupInvitations.id, inv.id));
  } catch (error) {
    console.error("Failed to delete invitation (non-fatal):", error);
  }

  return Response.json({ success: true, groupId: inv.groupId });
}

export default function InviteGroupToken() {
  const data = useLoaderData<LoaderData>();
  const navigate = useNavigate();
  const location = useLocation();
  const [isAccepting, setIsAccepting] = useState(false);
  const [isDeclining, setIsDeclining] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Build login URL with redirect back to this invitation page
  const loginUrl = `/login?redirect=${encodeURIComponent(location.pathname)}`;

  const handleDecline = async () => {
    setIsDeclining(true);
    setError(null);

    try {
      const response = await fetch(window.location.pathname, {
        method: "DELETE",
        headers: {
          "Accept": "application/json",
        },
      });

      const contentType = response.headers.get("content-type");
      if (!contentType || !contentType.includes("application/json")) {
        navigate("/");
        return;
      }

      const result = await response.json();

      if (response.ok && result.success) {
        navigate("/");
      } else {
        setError(result.error || "Failed to decline invitation");
        setIsDeclining(false);
      }
    } catch (err) {
      console.error("Decline invitation error:", err);
      setError("Failed to decline invitation");
      setIsDeclining(false);
    }
  };

  const handleAccept = async () => {
    setIsAccepting(true);
    setError(null);

    try {
      const response = await fetch(window.location.pathname, {
        method: "POST",
        headers: {
          "Accept": "application/json",
        },
      });

      const contentType = response.headers.get("content-type");
      if (!contentType || !contentType.includes("application/json")) {
        // Response is not JSON, might be HTML - navigate to groups and let user check
        console.error("Unexpected response type:", contentType);
        navigate("/groups");
        return;
      }

      const result = await response.json();

      if (response.ok && result.success) {
        navigate(`/groups/${result.groupId}`);
      } else {
        setError(result.error || "Failed to accept invitation");
        setIsAccepting(false);
      }
    } catch (err) {
      console.error("Accept invitation error:", err);
      setError("Failed to accept invitation");
      setIsAccepting(false);
    }
  };

  return (
    <div className="min-h-screen max-lg:h-full max-lg:overflow-auto bg-gray-50 dark:bg-gray-900 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-8 max-w-md w-full">
        {data.status === "not_found" && (
          <>
            <div className="text-center mb-6">
              <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-red-100 dark:bg-red-900 flex items-center justify-center">
                <svg className="w-8 h-8 text-red-600 dark:text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Invitation Not Found</h1>
            </div>
            <p className="text-gray-600 dark:text-gray-400 text-center mb-6">
              This invitation link is invalid or has been revoked.
            </p>
            <Link
              to="/"
              className="block w-full px-4 py-2 bg-blue-600 text-white text-center rounded hover:bg-blue-700"
            >
              Go to Maps
            </Link>
          </>
        )}

        {data.status === "expired" && (
          <>
            <div className="text-center mb-6">
              <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-yellow-100 dark:bg-yellow-900 flex items-center justify-center">
                <svg className="w-8 h-8 text-yellow-600 dark:text-yellow-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Invitation Expired</h1>
            </div>
            <p className="text-gray-600 dark:text-gray-400 text-center mb-6">
              This invitation has expired. Please ask for a new invitation.
            </p>
            <Link
              to="/"
              className="block w-full px-4 py-2 bg-blue-600 text-white text-center rounded hover:bg-blue-700"
            >
              Go to Maps
            </Link>
          </>
        )}

        {data.status === "requires_login" && data.group && (
          <>
            <div className="text-center mb-6">
              <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center">
                <svg className="w-8 h-8 text-blue-600 dark:text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
              </div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                Join {data.group.name}
              </h1>
            </div>
            {data.invitedBy && (
              <p className="text-gray-600 dark:text-gray-400 text-center mb-4">
                {data.invitedBy} invited you to join this group.
              </p>
            )}
            {data.group.description && (
              <p className="text-gray-500 dark:text-gray-500 text-center text-sm mb-6">
                {data.group.description}
              </p>
            )}
            <p className="text-gray-600 dark:text-gray-400 text-center mb-6">
              Please log in or create an account to accept this invitation.
            </p>
            <Link
              to={loginUrl}
              className="block w-full px-4 py-2 bg-blue-600 text-white text-center rounded hover:bg-blue-700"
            >
              Log In to Accept
            </Link>
          </>
        )}

        {data.status === "already_member" && data.group && (
          <>
            <div className="text-center mb-6">
              <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-green-100 dark:bg-green-900 flex items-center justify-center">
                <svg className="w-8 h-8 text-green-600 dark:text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Already a Member</h1>
            </div>
            <p className="text-gray-600 dark:text-gray-400 text-center mb-6">
              You're already a member of <strong>{data.group.name}</strong>.
            </p>
            <Link
              to={`/groups/${data.group.id}`}
              className="block w-full px-4 py-2 bg-blue-600 text-white text-center rounded hover:bg-blue-700"
            >
              Go to Group
            </Link>
          </>
        )}

        {data.status === "limit_reached" && data.group && (
          <>
            <div className="text-center mb-6">
              <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-yellow-100 dark:bg-yellow-900 flex items-center justify-center">
                <svg className="w-8 h-8 text-yellow-600 dark:text-yellow-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Group Limit Reached</h1>
            </div>
            <p className="text-gray-600 dark:text-gray-400 text-center mb-6">
              You can only be a member of {data.maxGroups} groups. Leave a group to accept this invitation.
            </p>
            <Link
              to="/groups"
              className="block w-full px-4 py-2 bg-blue-600 text-white text-center rounded hover:bg-blue-700"
            >
              Groups
            </Link>
          </>
        )}

        {data.status === "email_mismatch" && data.group && (
          <>
            <div className="text-center mb-6">
              <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-yellow-100 dark:bg-yellow-900 flex items-center justify-center">
                <svg className="w-8 h-8 text-yellow-600 dark:text-yellow-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
              </div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Email Mismatch</h1>
            </div>
            <p className="text-gray-600 dark:text-gray-400 text-center mb-4">
              This invitation to <strong>{data.group.name}</strong> was sent to <strong>{data.invitedEmail}</strong>.
            </p>
            <p className="text-gray-600 dark:text-gray-400 text-center mb-6">
              Please log in with that email address to accept the invitation.
            </p>
            <Link
              to="/"
              className="block w-full px-4 py-2 bg-blue-600 text-white text-center rounded hover:bg-blue-700"
            >
              Go to Maps
            </Link>
          </>
        )}

        {data.status === "valid" && data.group && (
          <>
            <div className="text-center mb-6">
              <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center">
                <svg className="w-8 h-8 text-blue-600 dark:text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
              </div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                Join {data.group.name}
              </h1>
            </div>
            {data.invitedBy && (
              <p className="text-gray-600 dark:text-gray-400 text-center mb-4">
                {data.invitedBy} invited you to join this group.
              </p>
            )}
            {data.group.description && (
              <p className="text-gray-500 dark:text-gray-500 text-center text-sm mb-6">
                {data.group.description}
              </p>
            )}
            {error && (
              <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded text-red-700 dark:text-red-300 text-sm">
                {error}
              </div>
            )}
            <div className="flex gap-3">
              <button
                onClick={handleDecline}
                disabled={isDeclining || isAccepting}
                className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 text-center rounded hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 cursor-pointer"
              >
                {isDeclining ? "Declining..." : "Decline"}
              </button>
              <button
                onClick={handleAccept}
                disabled={isAccepting || isDeclining}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 cursor-pointer"
              >
                {isAccepting ? "Joining..." : "Accept Invitation"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
