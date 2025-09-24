export default function Home() {
  return (
    <main style={{ padding: 24 }}>
      <h1>Portal Planner</h1>
      <p>
        <a href={`${process.env.NEXT_PUBLIC_API_URL}/auth/login`}>Login with Bungie</a>
      </p>
    </main>
  );
}
