(function () {
  window.PartnerLinksSupportKnowledge = {
    version: 'support_kb_v1',
    escalationMessage: 'I can flag this for PartnerLinks support. Please share only the email on the account and the Shopify .myshopify.com store domain if this is a brand issue. Do not share passwords, card numbers, API keys, private keys, webhook secrets, or recovery codes.',
    boundaries: [
      'PartnerLinks support cannot promise payouts or guarantee earnings.',
      'Accounted earnings are not necessarily funded earnings.',
      'Live creator payouts and settlement automation are not public-launch features yet.',
      'Sensitive financial, account ownership, payout, or store-access issues should go to a human/admin review path.'
    ],
    quickReplies: [
      'What is PartnerLinks?',
      'Why are earnings pending?',
      'My referral link is not redirecting',
      'I cannot access my dashboard',
      'Shopify app issue',
      'Contact support'
    ],
    topics: [
      {
        id: 'overview',
        title: 'What PartnerLinks is',
        keywords: ['what is partnerlinks', 'what does partnerlinks do', 'overview', 'explain partnerlinks'],
        answer: 'PartnerLinks helps brands and creators run referral links, Shopify attribution, creator invite chains, earnings tracking, and payout workflows. It is currently focused on deterministic tracking and safe accounting before broad live payout automation.'
      },
      {
        id: 'brand_onboarding',
        title: 'Brand onboarding',
        keywords: ['brand onboarding', 'register business', 'connect shopify', 'brand setup', 'brand dashboard', 'shopify connect'],
        answer: 'Brands start by connecting a Shopify store, confirming setup details, and inviting creators with a brand onboarding link. Brand admin pages require the signed-in owner for that exact brand. If you see the wrong dashboard, check that you are signed into the intended Google account and Shopify store context.'
      },
      {
        id: 'creator_onboarding',
        title: 'Creator onboarding',
        keywords: ['creator onboarding', 'creator signup', 'join as creator', 'google signup', 'invite link', 'creator invite'],
        answer: 'Creators join with Google, receive a creator code, and can share referral links. If you joined from an invite, PartnerLinks records the invite lineage after successful signup, not just from visiting the link.'
      },
      {
        id: 'referral_links',
        title: 'Referral link basics',
        keywords: ['referral link', 'tracking link', 'link not redirecting', 'product link', 'redirect', '/r/', 'cart'],
        answer: 'Product referral links should route through PartnerLinks first, create a tracking click, generate a partnerlinks_ref, then send the shopper to the Shopify product or cart path with attribution fields. If a link goes to the generic site, the brand/product route may not be configured or deployed yet.'
      },
      {
        id: 'creator_chain',
        title: 'Creator invite chain basics',
        keywords: ['invite chain', 'creator chain', 'network', 'level 1', 'level 2', 'level 3', 'downstream', 'upstream'],
        answer: 'Creator invite chains can create Level 1, Level 2, and Level 3 network override rows from eligible downstream platform fees. There is a hard stop after Level 3, and creators should not earn network overrides from their own direct sales.'
      },
      {
        id: 'shopify_connection',
        title: 'Shopify connection basics',
        keywords: ['shopify', 'app not installed', 'wrong store', 'shopify account', 'store context', 'myshopify', 'oauth'],
        answer: 'Shopify identity is tied to the canonical .myshopify.com store domain. If install or reconnect behaves strangely, confirm you are in the correct Shopify account and store, then reconnect from the brand setup flow. Shopify app-installed state and PartnerLinks local store records can diverge.'
      },
      {
        id: 'attribution',
        title: 'Tracking and attribution',
        keywords: ['attribution', 'click', 'partnerlinks_ref', 'tracking', 'conversion', 'order attribution', 'not tracked'],
        answer: 'PartnerLinks prefers exact partnerlinks_ref attribution from the referral click and Shopify cart/order attributes. If deterministic attribution is missing and multiple creators could match, the safe behavior is to skip attribution instead of guessing.'
      },
      {
        id: 'earnings_states',
        title: 'Pending vs claimable earnings',
        keywords: ['pending', 'claimable', 'pending settlement', 'earnings pending', 'why not claimable', 'claim disabled', 'settlement'],
        answer: 'Pending or accounted earnings are not the same as funded or claimable earnings. Earnings may stay pending while settlement, review, or beta safety gates are incomplete. PartnerLinks should not promise payment from a conversion alone.'
      },
      {
        id: 'payout_status',
        title: 'Payout status',
        keywords: ['payout', 'stripe', 'claim', 'claimed', 'transfer', 'payout disabled', 'stripe connect'],
        answer: 'Payout status can include pending, claimable, claimed, blocked, or setup-required states. Live payouts remain guarded. If claims are unavailable, it may be because settlement, manual approval, reserve coverage, or sandbox-only payout mode requirements are not met.'
      },
      {
        id: 'dashboard_access',
        title: 'Dashboard access',
        keywords: ['cannot access dashboard', 'dashboard blocked', 'brand dashboard', 'creator dashboard', 'owner email', 'wrong email', 'access denied'],
        answer: 'Creator dashboards are tied to the signed-in creator account. Brand dashboards require the signed-in owner/admin for that exact brand. If access is blocked, check the Google email and, for brands, the Shopify store domain. Owner mismatch issues should go to human support.'
      },
      {
        id: 'beta_limits',
        title: 'Sandbox and beta limitations',
        keywords: ['beta', 'sandbox', 'live payouts', 'production', 'test mode', 'bogus gateway', 'limitations'],
        answer: 'Some PartnerLinks flows are still controlled beta or sandbox-only. Sandbox tests can prove internal logic, but they do not prove production payout readiness, Shopify protected customer data approval, or live settlement readiness.'
      },
      {
        id: 'privacy',
        title: 'Safety and privacy',
        keywords: ['password', 'secret', 'api key', 'card', 'private key', 'security', 'privacy'],
        answer: 'Please do not share passwords, API keys, webhook secrets, private keys, recovery codes, or full card numbers. For account ownership help, share only the account email and Shopify .myshopify.com store domain.'
      },
      {
        id: 'escalation',
        title: 'Support escalation',
        keywords: ['contact support', 'human', 'admin', 'help me', 'support', 'escalate', 'flag'],
        answer: 'I can flag this for PartnerLinks support. For safe triage, share the account email, creator code if relevant, and Shopify .myshopify.com store domain for brand issues. Do not share secrets or payment details.'
      }
    ]
  };
})();
