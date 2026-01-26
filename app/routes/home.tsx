import type { Route } from "./+types/home";
import { Form, useLoaderData } from "react-router";
import { requireAuth } from "~/.server/auth/session";

export function meta({}: Route.MetaArgs) {
  return [
    { title: "Dashboard" },
    { name: "description", content: "Welcome to your dashboard" },
  ];
}

export async function loader({ request }: Route.LoaderArgs) {
  const session = await requireAuth(request);
  return { username: session.get("username") };
}

export default function Home() {
  const { username } = useLoaderData<typeof loader>();

  return (
    <main className="min-h-screen bg-gray-50 dark:bg-gray-900 p-8">
      <div className="max-w-4xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            Welcome, {username}!
          </h1>
          <Form method="post" action="/logout">
            <button
              type="submit"
              className="px-4 py-2 text-sm bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-white rounded hover:bg-gray-300 dark:hover:bg-gray-600"
            >
              Logout
            </button>
          </Form>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <p className="text-gray-700 dark:text-gray-300">
            You are logged in. This is a protected page.
          </p>
        </div>
      </div>
    </main>
  );
}
