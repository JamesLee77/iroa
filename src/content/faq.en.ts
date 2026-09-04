import type { FaqPageContent } from '../types/faq';

export const faqEn: FaqPageContent = {
  eyebrow: 'IROA CORE Q&A',
  title: 'Core questions about the IROA project',
  lead:
    'Twenty-two questions covering what IROA is building, who it is for, and what it does not do yet.',
  notice:
    'IROA is a project in preparation. Answers below carry a planned, in-validation, or long-term research marker wherever the capability is not operating. Marked capabilities are not available yet, and in a real emergency you should contact the official emergency services in your country.',
  contentsLabel: 'Question list',
  groups: [
    {
      id: 'overview',
      title: 'Project overview',
      entries: [
        {
          id: 'what-is-iroa',
          question: 'What is the IROA project?',
          answer: [
            'IROA is an integrated care platform that uses AI to reduce loneliness and the risk of dying alone among older adults, disabled people, and people living by themselves.',
            'The goal is to bring AI companionship, health management, daily-life monitoring, emergency detection, and connections to guardians and professional institutions into a single system.',
          ],
        },
        {
          id: 'name-meaning',
          question: 'What does the name IROA mean?',
          answer: [
            'IROA carries the meaning of connecting people to people, people to AI, and households to their local community, opening a safer and warmer path for care.',
            'It stands for a human-centred philosophy of care rather than a technology brand alone.',
          ],
        },
        {
          id: 'problem',
          question: 'What problem does IROA set out to solve?',
          answer: [
            'IROA addresses an ageing population, the growth of single-person households, gaps in disability care, the burden carried by guardians, social isolation, and dying alone.',
            'It uses AI and digital technology to supplement a practical limit: care staff alone cannot watch over everyone twenty-four hours a day.',
          ],
        },
        {
          id: 'principle',
          question: 'What matters most to the IROA project?',
          answer: [
            'IROA works toward a society in which no one is left alone and unattended.',
            'It treats human life and dignity, emotional stability, and a safe daily life as its highest values, ahead of technical advancement for its own sake.',
          ],
        },
      ],
    },
    {
      id: 'users-and-services',
      title: 'Users and services',
      entries: [
        {
          id: 'who-uses',
          question: 'Who are IROA’s primary users?',
          answer: ['The primary users are:'],
          points: [
            'Older adults living alone and single-person households',
            'Disabled people with limited mobility or ongoing care needs',
            'People with chronic conditions and patients recovering after discharge',
            'Families and guardians of people who need care',
            'Care facilities, hospitals, welfare institutions, and local governments',
            'Social workers and daily-living support workers who provide care',
          ],
        },
        {
          id: 'services',
          question: 'What services does IROA provide?',
          answer: ['IROA aims to bring the following into one care system.'],
          points: [
            'AI companionship and emotional connection',
            'Medication and schedule reminders, daily-habit management',
            'Health status checks and detection of reduced movement',
            'Extended non-response checks, fall and emergency detection',
            'Guardian alerts and connections to hospitals and welfare institutions',
          ],
          status: 'planned',
        },
        {
          id: 'ai-companion',
          question: 'How does the AI companion work?',
          answer: [
            'The intent is for AI to hold natural conversations, learning a person’s interests and daily habits to tailor how it talks with them.',
            'It is designed to ask how someone is doing, check on meals, sleep, and medication, and ease loneliness and low mood through conversation about music, news, and memories.',
          ],
          status: 'planned',
        },
        {
          id: 'difference',
          question: 'How is IROA different from an ordinary AI chat service?',
          answer: [
            'Where a general AI chat service concentrates on questions and answers, IROA looks at daily life, health, and safety alongside the conversation.',
            'The largest difference is that it builds a real care chain: when something looks wrong, it connects the person to family, guardians, and welfare institutions.',
          ],
        },
      ],
    },
    {
      id: 'safety',
      title: 'Safety and response',
      entries: [
        {
          id: 'lonely-death',
          question: 'How does IROA help prevent someone dying alone?',
          answer: [
            'The design under development checks on a person in stages when there has been no movement or conversation for a period, or when their routine differs from usual.',
            'If the signs continue, the goal is to notify a pre-registered guardian or care institution so that someone can check quickly and respond.',
          ],
          status: 'planned',
        },
        {
          id: 'emergency',
          question: 'How are emergencies detected?',
          answer: [
            'The intended approach connects smartphones, wearables, AI speakers, home sensors, and care robots to detect falls, extended non-response, unusual movement, and sharp changes in health data.',
            'What can actually be detected depends on the connected devices and service configuration, and IROA does not replace official emergency services.',
          ],
          status: 'planned',
        },
        {
          id: 'guardians',
          question: 'What does IROA offer families and guardians?',
          answer: [
            'Families and guardians are meant to see how someone is doing, their activity, medication adherence, and key alerts through a dedicated app or management system.',
            'When something urgent happens, they receive an immediate alert so they can respond quickly, which is intended to ease the worry and burden of caregiving.',
          ],
          status: 'planned',
        },
        {
          id: 'institutions',
          question: 'Can IROA connect with hospitals and welfare institutions?',
          answer: [
            'IROA is aimed at being a platform that can connect with hospitals, care facilities, social welfare institutions, local governments, and emergency-safety agencies.',
            'Information is passed on according to the user’s consent and data-protection principles, so each institution can deliver care in an organised way.',
          ],
          status: 'planned',
        },
      ],
    },
    {
      id: 'technology',
      title: 'Technology and data',
      entries: [
        {
          id: 'technology-stack',
          question: 'What technology does IROA use?',
          answer: [
            'IROA draws on conversational generative AI, speech recognition and synthesis, analysis of emotion and daily patterns, anomaly detection, wearable and IoT sensor integration, data security, and guardian alerting.',
            'The plan is to extend into offline daily-life support later by connecting physical AI and care robots.',
          ],
        },
        {
          id: 'physical-ai',
          question: 'What is physical AI?',
          answer: [
            'Physical AI is technology in which artificial intelligence combines with smart devices or robots to help people in the physical world.',
            'For IROA it could grow into care functions that daily life actually needs: mobility assistance, fetching objects, guidance around the home, safety checks, and remote communication.',
          ],
          status: 'research',
        },
        {
          id: 'privacy',
          question: 'Are personal and health data kept safe?',
          answer: [
            'IROA takes minimal collection, prior user consent, encryption, access control, and record keeping as its founding principles.',
            'Sensitive health data in particular is handled according to applicable law and security standards, and the design lets each person choose what is shared and with whom.',
          ],
        },
      ],
    },
    {
      id: 'business-and-value',
      title: 'Business and social value',
      entries: [
        {
          id: 'business-model',
          question: 'What is IROA’s business model?',
          answer: [
            'The business model can be built from subscriptions for individual users, enterprise services for hospitals, care facilities, and welfare institutions, local-government care programmes, supply and leasing of AI care devices, health-management content, and integrated management systems for institutions.',
          ],
          status: 'planned',
        },
        {
          id: 'social-value',
          question: 'What social value does the IROA project carry?',
          answer: [
            'IROA can contribute to preventing deaths in isolation and safety accidents, closing gaps in care coverage, emotional stability for older and disabled people, relief for families carrying care duties, and better efficiency for care workers.',
            'It also matters as a way of building a new community-centred care safety net with digital technology.',
          ],
        },
        {
          id: 'human-care',
          question: 'Does IROA replace human care?',
          answer: [
            'No. IROA does not aim to replace families, social workers, carers, or clinicians. It aims to help them provide care more effectively.',
            'The model is collaborative: AI handles observation and alerting, while people hold the important judgements and the emotional care.',
          ],
        },
        {
          id: 'rewards',
          question: 'What is IROA’s reward structure?',
          answer: [
            'IROA may consider points or digital rewards for the health-management and care activity of ecosystem participants, including users, guardians, care providers, and volunteers.',
            'Rewards could connect to care services, health programmes, donations, and community activity, and the specific structure must be designed after a review of applicable law and regulation.',
          ],
          status: 'validation',
        },
      ],
    },
    {
      id: 'plan-and-vision',
      title: 'Plan and vision',
      entries: [
        {
          id: 'roadmap',
          question: 'What is IROA’s phased plan?',
          answer: [
            'The early phase builds the core functions: AI companionship, wellbeing checks, medication reminders, and guardian connection.',
            'Pilot programmes with hospitals, welfare institutions, and local governments follow, alongside wearable and IoT sensor integration and care robots.',
            'Over the long term, the goal is a global AI care platform that can extend beyond one region or country.',
          ],
          status: 'planned',
        },
        {
          id: 'competitiveness',
          question: 'Why could IROA compete with existing care services?',
          answer: [
            'IROA differs by integrating emotional conversation, health management, daily-life monitoring, emergency response, and institutional connection into a single platform.',
            'It also aims to learn each person’s routine to tailor care, and to stay extensible enough to connect with many devices and professional institutions.',
          ],
        },
        {
          id: 'future',
          question: 'What future does IROA ultimately want to build?',
          answer: [
            'IROA works toward a society where anyone can receive the care they need regardless of age, disability, financial circumstances, or where they live.',
            'The ultimate vision is not a future where AI replaces people, but a warm care ecosystem where AI connects and protects people more attentively.',
          ],
        },
      ],
    },
  ],
  closing: {
    title: 'The core message of the IROA project',
    message:
      'IROA is not technology for watching people with AI. It is a human-centred integrated care platform that notices loneliness and risk first, then connects the person to their family and community.',
  },
  whitepaperCta: {
    label: 'Read more in the whitepaper',
    href: '/en/whitepaper',
  },
};
