(function () {
  window.PartnerLinksSupportKnowledge = {
    version: 'support_kb_v2_approved_answers',
    sourceDocument: 'SUPPORT_KNOWLEDGE_BASE.md',
    escalationMessage: 'I may need PartnerLinks support to review that. Please include your store domain, account email, and a short description of the issue. Do not share passwords, API keys, webhook secrets, private keys, recovery codes, or full payment card details.',
    boundaries: [
      'PartnerLinks support cannot promise payouts or guarantee earnings.',
      'Accounted earnings are not necessarily funded or claimable earnings.',
      'Live creator payouts and settlement automation are not public-launch features unless PROJECT_STATUS.md says otherwise.',
      'Sensitive financial, account ownership, payout, refund, security, or store-access issues should go to human/admin review.'
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
        id: 'what_is_partnerlinks',
        title: 'What Is PartnerLinks?',
        intent: 'User asks what PartnerLinks is or what it does.',
        approvedResponse: 'PartnerLinks helps brands and creators run referral links, Shopify attribution, creator invite flows, earnings tracking, and payout workflows. It is built as brand program infrastructure, with an emphasis on deterministic tracking, clear money states, and safe operations.',
        sensitive: false,
        public: true,
        sourceOfTruth: ['CHAT_HANDOFF.md', 'PROJECT_STATUS.md', 'GO_TO_MARKET_STRATEGY.md'],
        lastReviewed: '2026-05-18',
        keywords: ['what is partnerlinks', 'what does partnerlinks do', 'overview', 'explain partnerlinks', 'brand program infrastructure', 'affiliate', 'referral platform']
      },
      {
        id: 'brand_onboarding',
        title: 'Brand Onboarding Overview',
        intent: 'Brand asks how to get started or connect a business.',
        approvedResponse: 'Brands start by connecting a Shopify store, completing brand setup, setting creator commission terms, and sharing creator onboarding links. Brand dashboard and setup access require the signed-in owner/admin for that exact brand.',
        sensitive: true,
        public: true,
        sourceOfTruth: ['PROJECT_STATUS.md', 'SUPPORT_AGENT.md', 'system-audit/OPERATIONAL_RUNBOOKS.md'],
        lastReviewed: '2026-05-18',
        keywords: ['brand onboarding', 'register business', 'connect shopify', 'brand setup', 'brand dashboard', 'creator commission', 'invite creators', 'start as a brand', 'business setup']
      },
      {
        id: 'creator_onboarding',
        title: 'Creator Onboarding Overview',
        intent: 'Creator asks how to join or get a creator account.',
        approvedResponse: 'Creators join with Google, receive a creator code, and can use referral links to share brands or products. If a creator joins from an invite, PartnerLinks records the invite context after successful signup.',
        sensitive: false,
        public: true,
        sourceOfTruth: ['PROJECT_STATUS.md', 'CHAT_HANDOFF.md'],
        lastReviewed: '2026-05-18',
        keywords: ['creator onboarding', 'creator signup', 'join as creator', 'google signup', 'creator account', 'creator code', 'invite link', 'join link']
      },
      {
        id: 'referral_links',
        title: 'Referral Links Overview',
        intent: 'User asks how referral links work or why a link redirects.',
        approvedResponse: 'Referral links route through PartnerLinks first so the system can record a click, create a tracking reference, and send the shopper to the correct brand or Shopify product path. Product links should preserve attribution data so Shopify order attribution can be resolved later.',
        sensitive: false,
        public: true,
        sourceOfTruth: ['PROJECT_STATUS.md', 'CHAT_HANDOFF.md'],
        lastReviewed: '2026-05-18',
        keywords: ['referral link', 'tracking link', 'link not redirecting', 'product link', 'redirect', '/r/', 'cart link', 'partnerlinks_ref', 'share link', 'link goes wrong']
      },
      {
        id: 'creator_invite_chains',
        title: 'Creator Invite Chains / Creator Participation Explanation',
        intent: 'User asks how creator invites, creator participation, or reward levels work.',
        approvedResponse: 'PartnerLinks supports creator participation where creators can invite other creators into participating brand programs. Program rewards are tied to tracked referral outcomes, not signups alone. Current creator reward logic stops after Level 3 and should not reward a creator for their own direct sale.',
        sensitive: true,
        public: true,
        sourceOfTruth: ['PROJECT_STATUS.md', 'GO_TO_MARKET_STRATEGY.md', 'system-audit/ECONOMIC_ARCHITECTURE.md'],
        lastReviewed: '2026-05-18',
        keywords: ['creator invite chain', 'creator participation', 'invite creators', 'level 1', 'level 2', 'level 3', 'program reward', 'referral reward', 'brand program activity']
      },
      {
        id: 'shopify_install_connect',
        title: 'Shopify Install / Connect Overview',
        intent: 'Brand asks how Shopify install/connect works.',
        approvedResponse: 'PartnerLinks connects to Shopify through the brand onboarding flow. Shopify identity is based on the canonical .myshopify.com store domain, and the install flow depends on the user being in the correct Shopify account and store context.',
        sensitive: true,
        public: true,
        sourceOfTruth: ['PROJECT_STATUS.md', 'INFRASTRUCTURE_DECISION_RULES.md', 'system-audit/OPERATIONAL_RUNBOOKS.md'],
        lastReviewed: '2026-05-18',
        keywords: ['shopify install', 'connect shopify', 'shopify app', 'shopify oauth', 'install app', 'connect store', 'myshopify', 'shopify setup']
      },
      {
        id: 'shopify_context_confusion',
        title: 'Shopify Account / Store Context Confusion',
        intent: 'User is confused because Shopify says the app is installed/uninstalled, or they are in the wrong account/store.',
        approvedResponse: "Shopify account and store context can be confusing. Please confirm the exact .myshopify.com domain and the email you are using. PartnerLinks local connected state can differ from Shopify's installed-app state, so support may need to review the store connection safely.",
        sensitive: true,
        public: true,
        sourceOfTruth: ['SUPPORT_AGENT_TRAINING_LOG.md', 'PROJECT_STATUS.md', 'INFRASTRUCTURE_DECISION_RULES.md'],
        lastReviewed: '2026-05-18',
        keywords: ['wrong shopify account', 'wrong store', 'app not installed', 'app installed', 'uninstalled', 'store context', 'shopify says', 'reconnect', 'oauth loop']
      },
      {
        id: 'dashboard_access',
        title: 'Dashboard Access / Wrong Owner Email',
        intent: 'User cannot access a creator or brand dashboard, or sees the wrong workspace.',
        approvedResponse: 'Creator dashboards are tied to the signed-in creator account. Brand dashboards require the signed-in owner/admin for that exact brand. If access is blocked or the wrong dashboard opens, check the Google email and Shopify store domain first, then support can review the owner binding.',
        sensitive: true,
        public: true,
        sourceOfTruth: ['PROJECT_STATUS.md', 'SUPPORT_AGENT_TRAINING_LOG.md'],
        lastReviewed: '2026-05-18',
        keywords: ['cannot access dashboard', 'dashboard blocked', 'wrong dashboard', 'brand dashboard', 'creator dashboard', 'owner email', 'wrong email', 'access denied', 'owner binding']
      },
      {
        id: 'pending_vs_claimable',
        title: 'Pending Earnings Vs Claimable Earnings',
        intent: 'Creator asks why earnings are pending or not claimable.',
        approvedResponse: 'Pending or accounted earnings are not always claimable. Claimable earnings may require settlement, manual approval, reserve coverage, or other safety checks. A conversion does not automatically mean funds are safe to pay.',
        sensitive: true,
        public: true,
        sourceOfTruth: ['PROJECT_STATUS.md', 'INFRASTRUCTURE_DECISION_RULES.md', 'system-audit/ECONOMIC_ARCHITECTURE.md'],
        lastReviewed: '2026-05-18',
        keywords: ['pending earnings', 'claimable earnings', 'pending settlement', 'earnings pending', 'why not claimable', 'accounted earnings', 'funded earnings', 'safe to pay', 'conversion paid']
      },
      {
        id: 'payout_status',
        title: 'Payout Status Explanation',
        intent: 'Creator asks what payout status means.',
        approvedResponse: 'Payout status may include pending, claimable, claimed, blocked, setup-required, or review states. PartnerLinks should not promise payouts from a conversion alone. If a payout status looks wrong, support can review the account and explain the current blocker.',
        sensitive: true,
        public: true,
        sourceOfTruth: ['PROJECT_STATUS.md', 'SUPPORT_AGENT.md', 'INFRASTRUCTURE_DECISION_RULES.md'],
        lastReviewed: '2026-05-18',
        keywords: ['payout status', 'payout', 'stripe', 'claimed', 'transfer', 'payout disabled', 'stripe connect', 'missing payout', 'paid', 'payment']
      },
      {
        id: 'claim_button_disabled',
        title: 'Claim Button Disabled',
        intent: 'Creator asks why the Claim button is unavailable.',
        approvedResponse: 'If the Claim button is disabled, the account may not currently meet payout, settlement, approval, reserve, setup, or beta safety requirements. PartnerLinks support can review the account and explain the current blocker, but the support agent cannot promise payout timing or approval.',
        sensitive: true,
        public: true,
        sourceOfTruth: ['PROJECT_STATUS.md', 'SUPPORT_AGENT_TRAINING_LOG.md', 'system-audit/OPERATIONAL_RUNBOOKS.md'],
        lastReviewed: '2026-05-18',
        keywords: ['claim button disabled', 'claim disabled', 'claim unavailable', 'cannot claim', 'claim earnings', 'claim blocked', 'button disabled']
      },
      {
        id: 'refunds_reversals',
        title: 'Refunds And Reversals',
        intent: 'User asks what happens after refunds, reversals, disputes, or chargebacks.',
        approvedResponse: 'Refund and reversal handling is a sensitive financial workflow. PartnerLinks may record diagnostic reversal information, but refund enforcement, payout offsets, and balance adjustments should be reviewed by an operator. Support can flag refund or reversal questions for admin review.',
        sensitive: true,
        public: true,
        sourceOfTruth: ['PROJECT_STATUS.md', 'SUPPORT_AGENT_TRAINING_LOG.md', 'system-audit/ECONOMIC_ARCHITECTURE.md'],
        lastReviewed: '2026-05-18',
        keywords: ['refund', 'reversal', 'chargeback', 'dispute', 'offset', 'clawback', 'balance adjustment', 'refunded order']
      },
      {
        id: 'protected_customer_data',
        title: 'Protected Customer Data / Shopify Webhook Limitation',
        intent: 'User asks why Shopify order/refund ingestion or webhooks are not fully working in production.',
        approvedResponse: 'Some Shopify order and refund webhook topics require protected customer data approval. Sandbox or diagnostic tests can verify PartnerLinks internal logic, but they do not prove production Shopify approval or live webhook readiness.',
        sensitive: true,
        public: true,
        sourceOfTruth: ['PROJECT_STATUS.md', 'INFRASTRUCTURE_DECISION_RULES.md', 'SUPPORT_AGENT_TRAINING_LOG.md'],
        lastReviewed: '2026-05-18',
        keywords: ['protected customer data', 'shopify webhook', 'orders paid', 'refunds create', 'order webhook', 'refund webhook', 'webhook limitation', 'orders not appearing', 'production webhook']
      },
      {
        id: 'beta_sandbox_limitations',
        title: 'Beta / Sandbox Limitations',
        intent: 'User asks what is live, beta, sandbox-only, or not available yet.',
        approvedResponse: 'Some PartnerLinks flows are beta or sandbox-only. Sandbox tests can validate internal logic, but they do not prove live payout readiness, production settlement readiness, protected customer data approval, or broader public-launch readiness.',
        sensitive: true,
        public: true,
        sourceOfTruth: ['PROJECT_STATUS.md', 'INFRASTRUCTURE_DECISION_RULES.md'],
        lastReviewed: '2026-05-18',
        keywords: ['beta', 'sandbox', 'test mode', 'live payouts', 'production ready', 'public launch', 'bogus gateway', 'limitations', 'live settlement']
      },
      {
        id: 'security_privacy',
        title: 'Security Reminder / Do Not Share Secrets',
        intent: 'User asks whether they should share credentials or sensitive information.',
        approvedResponse: 'PartnerLinks support will never ask for passwords, private keys, webhook secrets, API keys, recovery codes, or full payment card details. For account ownership help, share only the account email and Shopify .myshopify.com store domain if relevant.',
        sensitive: true,
        public: true,
        sourceOfTruth: ['SUPPORT_AGENT.md', 'INFRASTRUCTURE_DECISION_RULES.md', 'SUPPORT_AGENT_TRAINING_LOG.md'],
        lastReviewed: '2026-05-18',
        keywords: ['password', 'secret', 'api key', 'private key', 'webhook secret', 'card number', 'credit card', 'security', 'privacy', 'recovery code', 'share credentials']
      },
      {
        id: 'support_escalation',
        title: 'Support Escalation Path',
        intent: 'User needs human/admin support or asks for escalation.',
        approvedResponse: 'I can flag this for PartnerLinks support. Please share only the account email, creator code if relevant, and Shopify .myshopify.com store domain for brand issues. Do not share passwords, API keys, webhook secrets, private keys, recovery codes, or full payment card details.',
        sensitive: true,
        public: true,
        sourceOfTruth: ['SUPPORT_AGENT.md', 'SUPPORT_AGENT_TRAINING_LOG.md'],
        lastReviewed: '2026-05-18',
        keywords: ['contact support', 'human', 'admin', 'help me', 'support', 'escalate', 'flag this', 'talk to someone', 'review my account']
      },
      {
        id: 'internal_brand_b_testing',
        title: 'Internal-Only: Brand B / Testing-Specific Issues',
        intent: 'Internal operator asks about Brand B or test-store-specific issues.',
        approvedResponse: 'Brand B and test-store details are internal operator context and should not be exposed in public support responses. Public support should discuss general Shopify store connection, referral link, dashboard access, and beta limitation patterns unless an authorized operator is reviewing a specific test.',
        sensitive: true,
        public: false,
        sourceOfTruth: ['PROJECT_STATUS.md', 'system-audit/OPERATIONAL_RUNBOOKS.md', 'INFRASTRUCTURE_DECISION_RULES.md'],
        lastReviewed: '2026-05-18',
        keywords: ['brand b', 'novo loom', 'novo-loom', 'test creator', 'sandbox replay', 'diagnostic script', 'test order', 'internal route']
      }
    ]
  };
})();
