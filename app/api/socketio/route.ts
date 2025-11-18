// This file is needed for Next.js to handle the socket.io path
// The actual socket server is initialized in a custom server file
export async function GET() {
  return new Response("Socket.io endpoint", { status: 200 });
}

