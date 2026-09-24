// The two default offer-email drafts (Paid / Unpaid) the Upcoming workflow's offer emails are
// rendered from. Moved here verbatim from the old src/mock-data/seedEmailTemplates.js when drafts
// moved from browser localStorage to the email_templates table — these are only ever written to
// the database by server/scripts/seedEmailTemplates.js (seedDefaultEmailTemplates() in
// ./candidateMessaging.js), never read at request time: MySQL is the single source of truth.
export const DEFAULT_EMAIL_TEMPLATES = [
  {
    id: 'tpl-email-paid',
    offerType: 'Paid',
    name: 'Paid Position',
    subject: 'Internship Opportunity at Rizurf — {{PositionName}}',
    body: `Dear {{ApplicantName}},

Thank you for your patience throughout the selection process.

We were pleased with your application and are happy to offer you a {{PositionName}} Internship at Rizurf, with a monthly allowance of RM600.

If you are still interested in this position and wish to proceed further, please reply to this email with the following details:

• Full Name
• IC / Passport Number
• Internship Start Date
• Internship End Date
• Email Address
• Phone Number
• Home Address

Kindly also attach a copy of your IC/Passport and your University Support Letter.

If you have any further questions, please do not hesitate to contact us.

We look forward to hearing from you!

Best regards,
{{HiringEmployeeName}}
Rizurf Team`,
  },
  {
    id: 'tpl-email-unpaid',
    offerType: 'Unpaid',
    name: 'Unpaid Position',
    subject: 'Internship Opportunity at Rizurf — {{PositionName}}',
    body: `Dear {{ApplicantName}},

Thank you for your patience throughout the selection process.

We were pleased with your application and are happy to offer you a {{PositionName}} Internship at Rizurf. Please note that this is an unpaid, hybrid internship position.

If you are still interested in this position and wish to proceed further, please reply to this email with the following details:

• Full Name
• IC / Passport Number
• Internship Start Date
• Internship End Date
• Email Address
• Phone Number
• Home Address

Kindly also attach a copy of your IC/Passport and your University Support Letter.

If you have any further questions, please do not hesitate to contact us.

We look forward to hearing from you!

Best regards,
{{HiringEmployeeName}}
Rizurf Team`,
  },
];
