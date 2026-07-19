interface IpApiResponse {
  status: string
  country: string
  regionName: string
  city: string
}

export async function getLocation(ip: string): Promise<string | null> {
  try {
    const response = await fetch(`http://ip-api.com/json/${ip}?lang=zh-CN&fields=status,country,regionName,city`, {
      next: { revalidate: 86400 },
    })
    if (!response.ok)
      throw new Error('Failed to fetch location')

    const data = (await response.json()) as IpApiResponse

    if (data.status !== 'success')
      return null

    const parts = [data.country, data.regionName, data.city].filter(Boolean)
    return parts.length > 0 ? parts.join(', ') : null
  }
  catch {
    return null
  }
}
