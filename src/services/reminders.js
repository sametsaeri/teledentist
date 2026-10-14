// FAZ 3-4 hazırlığı: hatırlatma + kampanya soyut servisi
// Şimdi: console + localStorage. Sonra: NetGSM/SMTP entegrasyonu buraya takılacak.
export const reminderService = {
  queue: [],
  send(type, to, message) {
    const item = { type, to, message, date: new Date().toISOString(), status: 'queued' }
    this.queue.push(item)
    return item
  }
}

export const campaignService = {
  points: {},
  earn(userId, amount, reason) {
    this.points[userId] = (this.points[userId] || 0) + amount
    return { userId, total: this.points[userId], reason }
  }
}
