import { RequirementDimension } from '../common/types/clarification.types';

interface ClarificationQuestion {
  question: string;
  followUp: string;
}

export const CLARIFICATION_QUESTIONS: Record<
  RequirementDimension,
  ClarificationQuestion
> = {
  [RequirementDimension.SCALE]: {
    question:
      "What's your expected traffic volume? (e.g., requests/second, daily active users, data volume in GB/month)",
    followUp:
      'Do you have any traffic spikes to account for? (e.g., batch jobs, peak business hours, seasonal surges)',
  },
  [RequirementDimension.LATENCY]: {
    question:
      'What are your latency requirements? Is this a real-time user-facing service, a background batch process, or something in between?',
    followUp:
      "What's an acceptable p99 response time for your users? (e.g., under 200ms, under 1s)",
  },
  [RequirementDimension.PERSISTENCE]: {
    question:
      'What data does your system need to store, and what are the read/write patterns? (e.g., high-read relational data, time-series events, user-uploaded files)',
    followUp:
      'Do you need strong consistency for all writes, or is eventual consistency acceptable for some operations?',
  },
  [RequirementDimension.TEAM]: {
    question:
      "How large is your engineering team, and what's your DevOps maturity level? (e.g., 3-person startup that prefers managed services vs. 20-person team comfortable with Kubernetes)",
    followUp:
      'Do you have 24/7 on-call requirements, or is best-effort availability acceptable outside business hours?',
  },
  [RequirementDimension.BUDGET]: {
    question:
      "What's your approximate monthly infrastructure budget? Are you optimizing for lowest cost, best performance, or a balance of both?",
    followUp:
      'Are you open to spot or preemptible instances for cost savings, or do you need predictable on-demand capacity?',
  },
  [RequirementDimension.COMPLIANCE]: {
    question:
      'Do you have any compliance or security requirements? (e.g., GDPR data residency, PCI-DSS, SOC 2, HIPAA)',
    followUp:
      'Does your data need to remain within a specific AWS region or geographic boundary for legal or regulatory reasons?',
  },
};
