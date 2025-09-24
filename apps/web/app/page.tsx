export default function Home() {
  return (
    <main style={{ padding: 24 }}>
      <h1>Portal Planner</h1>
      <p>
        {/* one click straight to OAuth */}
        <a href={`${process.env.NEXT_PUBLIC_API_URL}/auth/login`}>Login with Bungie</a>
      </p>
    </main>
  );
}
