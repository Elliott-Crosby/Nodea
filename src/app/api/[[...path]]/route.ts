function gone() {
  return Response.json({ error: 'The Nodea web app is no longer available.' }, {
    status: 410,
    headers: { 'Cache-Control': 'no-store' },
  })
}

export { gone as GET, gone as POST, gone as PUT, gone as PATCH, gone as DELETE, gone as OPTIONS, gone as HEAD }
