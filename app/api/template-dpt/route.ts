export async function GET() {
  const csv = [
    "identifier,name,group,email,phone",
    "12345678,Ahmad Fauzi,XII IPA 1,ahmad@example.com,081234567890",
    "12345679,Siti Rahma,XII IPA 1,siti@example.com,081234567891",
    "12345680,Budi Santoso,XII IPS 2,,081234567892",
  ].join("\r\n");

  return new Response(`\uFEFF${csv}\r\n`, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="template-dpt.csv"',
      "Cache-Control": "no-store",
    },
  });
}
