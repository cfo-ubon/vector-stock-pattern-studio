import type { Project } from './projectTypes';
import { computeCollectionScore } from '../collection/collectionScore';

// Project Studio's Designer Assistant — "review entire project", scoped the
// same way every prior not-yet-a-full-Phase-8-engine Designer Assistant
// check in this app has been: a real, rule-based function computed from
// the project's own already-generated data (reusing collection/
// collectionScore.ts per collection, not re-deriving its checks), not a
// placeholder waiting on a future roadmap phase.

export interface ProjectReview {
  collectionsReviewed: number;
  averageCollectionScore: number | null;
  issues: string[];
  recommendations: string[];
}

export function reviewProject(project: Project): ProjectReview {
  const issues: string[] = [];
  const recommendations: string[] = [];

  if (project.collections.length === 0) {
    issues.push('โปรเจกต์นี้ยังไม่มี Collection เลย');
    recommendations.push('กด Generate Collection เพื่อสร้างคอลเลกชันแรกของโปรเจกต์นี้');
  }

  const scores = project.collections.map((c) => computeCollectionScore(c.collection));
  scores.forEach((score, i) => {
    const label = project.collections[i].collection.manifest.collectionName;
    for (const issue of score.issues) issues.push(`${label}: ${issue}`);
    if (score.overall < 80) recommendations.push(`${label}: Collection Score ${score.overall}/100 — ตรวจสอบความสอดคล้องก่อนส่งขาย`);
  });

  const styleIds = new Set(project.collections.map((c) => c.collection.manifest.styleDnaId ?? 'none'));
  if (project.collections.length > 1 && styleIds.size > 1) {
    issues.push('Style DNA ไม่ตรงกันระหว่าง Collection ต่างๆ ในโปรเจกต์เดียวกัน');
    recommendations.push('ใช้ Style DNA เดียวกันทุก Collection เพื่อให้ทั้งโปรเจกต์มีเอกลักษณ์เดียวกัน');
  }

  if (!project.concept.trim()) recommendations.push('เพิ่ม Concept (บรีฟงานออกแบบ) ให้โปรเจกต์นี้');
  if (project.moodboard.length === 0) recommendations.push('เพิ่ม Moodboard (สี/โน้ตอ้างอิง) เพื่อกำหนดทิศทางงานออกแบบ');

  const averageCollectionScore =
    scores.length > 0 ? Math.round(scores.reduce((sum, s) => sum + s.overall, 0) / scores.length) : null;

  return {
    collectionsReviewed: scores.length,
    averageCollectionScore,
    issues: [...new Set(issues)],
    recommendations: [...new Set(recommendations)],
  };
}
