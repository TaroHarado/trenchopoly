// This route is used by Socket.io for the connection path
// The actual socket server is initialized in server/socket.ts
export async function GET() {
  return new Response("Socket.io endpoint", { status: 200 });
}

