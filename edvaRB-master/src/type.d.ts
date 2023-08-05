type ReferralCode = {
    id: number
    code: string
    totalInvited: number
    totalReferrals: number
    totalEarned: number
  };

type LevelTable = {
    referrals: number
    bonus: number
}

type HistoryTable = {
  date: string
  profit: number
  code: string
}

