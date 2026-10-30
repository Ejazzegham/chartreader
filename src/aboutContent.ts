// New text for the redesigned About page. Other languages fall back to English until translated;
// the contact and "Please note" texts reuse the translated strings already in guideContent.ts.
export type AboutPage = {
  tag: string; title1: string; title2: string; lead: string;
  chips: { icon: string; label: string }[];
  whoTag: string; whoTitle: string; who1: string; who2: string; sign: string;
  missionTitle: string; mission: string; visionTitle: string; vision: string;
  whyTag: string; whyTitle: string; whySub: string;
  cards: { icon: string; colors: [string, string]; title: string; text: string }[];
  contactTag: string; contactCardTitle: string;
  colQuick: string; colMarkets: string; colSupport: string; colStay: string; stayText: string; emailPh: string; subscribe: string; helpCenter: string;
  foot: string; slogan: string[]; footBlurb: string; tagline: string;
};

export const ABOUT_EN: AboutPage = {
  tag: 'About us', title1: 'Welcome to', title2: 'Chart Reader',
  lead: 'Your trusted trading analysis platform, designed to help you trade smarter with powerful tools, real-time data and proven strategies.',
  chips: [
    { icon: 'trending-up', label: 'Powerful\nAnalysis Tools' },
    { icon: 'flash', label: 'Real-time\nMarket Data' },
    { icon: 'shield-checkmark', label: 'Risk Management\n& Planning' },
    { icon: 'people', label: 'Dedicated\nSupport' },
  ],
  whoTag: 'Who we are', whoTitle: 'About Chart Reader',
  who1: 'Chart Reader is an educational trading analysis platform built for traders of all levels. Our mission is to make market analysis simple, practical, and effective by providing the right tools, resources and insights in one place.',
  who2: 'We combine modern technology with proven trading methods to help you understand the markets, improve your skills and make better trading decisions.',
  sign: 'Trade Smarter, Grow Together',
  missionTitle: 'Our Mission', mission: 'To empower traders with accurate analysis, smart tools and continuous learning, so they can trade with confidence and achieve long-term success.',
  visionTitle: 'Our Vision', vision: 'To become the most trusted and complete trading analysis platform for traders worldwide.',
  whyTag: 'Why choose us', whyTitle: 'Everything You Need in One Place',
  whySub: 'From live market analysis to advanced trading tools, Chart Reader gives you the edge.',
  cards: [
    { icon: 'trending-up', colors: ['#1F3A68', '#1F3A68'], title: 'Live Market Analysis', text: 'Get real-time market insights, charts and signals across multiple assets.' },
    { icon: 'bulb', colors: ['#1F3A68', '#1F3A68'], title: 'Smart Trading Tools', text: 'Use advanced tools like risk planner, journal and trade calculators.' },
    { icon: 'shield-checkmark', colors: ['#1F3A68', '#1F3A68'], title: 'Risk Management', text: 'Protect your capital with proper risk and position sizing tools.' },
    { icon: 'school', colors: ['#1F3A68', '#1F3A68'], title: 'Learning & Education', text: 'Access guides, tutorials and resources to improve your trading skills.' },
    { icon: 'globe', colors: ['#1F3A68', '#1F3A68'], title: 'Multi-Market Access', text: 'Trade Forex, Crypto, Indices, Commodities and more, all in one platform.' },
    { icon: 'headset', colors: ['#1F3A68', '#1F3A68'], title: '24/7 Support', text: 'Our team is always here to help you whenever you need assistance.' },
  ],
  contactTag: 'Get in touch', contactCardTitle: 'Questions, ideas or a problem?',
  colQuick: 'Quick Links', colMarkets: 'Markets', colSupport: 'Support', colStay: 'Stay Updated', stayText: 'Get the latest market insights and updates.',
  emailPh: 'Enter your email', subscribe: 'Subscribe', helpCenter: 'Help Center',
  foot: 'Chart Reader. All rights reserved.', slogan: ['Trade Smarter', 'Learn Faster', 'Grow Together'],
  footBlurb: 'Professional trading analysis, tools, real-time market data and powerful insights to help you make better trading decisions.', tagline: 'Trading analysis platform',
};
