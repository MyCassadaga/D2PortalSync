export default function LoginPage() {
  return (
    <main style={{padding: 24}}>
      <h1>Portal Planner</h1>
      <a href={process.env.NEXT_PUBLIC_API_URL + "/auth/login"}>Login with Bungie</a>
    </main>
  );
}
