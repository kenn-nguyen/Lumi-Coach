import { FIELD_PROVENANCE } from '../../../shared/job-snapshot.js';

function pickCompanyWinner(ldValue, domValue) {
  const ld = (ldValue || '').trim();
  const dom = (domValue || '').trim();
  if (!ld) return { value: dom, source: 'dom' };
  if (!dom) return { value: ld, source: 'ld' };
  if (ld.toLowerCase().includes(dom.toLowerCase())) return { value: ld, source: 'ld' };
  if (dom.toLowerCase().includes(ld.toLowerCase())) return { value: dom, source: 'dom' };
  return { value: dom, source: 'dom' };
}

export function reconcile(candidates) {
  const ld = candidates.ld ?? {};
  const testid = candidates.testid ?? {};
  const classes = candidates.classes ?? {};
  const heuristic = candidates.heuristic ?? {};

  const domDesc = testid.description || classes.description || '';
  const domProv = testid.description
    ? testid.descriptionProvenance
    : classes.description
      ? FIELD_PROVENANCE.class
      : FIELD_PROVENANCE.missing;

  let description = '';
  let descriptionProvenance = FIELD_PROVENANCE.missing;
  const ldDesc = ld.description || '';
  if (ldDesc || domDesc) {
    if (ldDesc.length >= domDesc.length * 1.25) {
      description = ldDesc;
      descriptionProvenance = FIELD_PROVENANCE.json_ld;
    } else {
      description = domDesc || ldDesc;
      descriptionProvenance = domDesc ? domProv : FIELD_PROVENANCE.json_ld;
    }
  } else if (heuristic.description) {
    description = heuristic.description;
    descriptionProvenance = FIELD_PROVENANCE.heuristic;
  }

  const domTitle = testid.title || classes.title || '';
  const title = domTitle || ld.title || '';
  const titleProvenance = domTitle
    ? (testid.title ? FIELD_PROVENANCE.testid : FIELD_PROVENANCE.class)
    : ld.title
      ? FIELD_PROVENANCE.json_ld
      : FIELD_PROVENANCE.missing;

  const domCompany = testid.company || classes.company || '';
  const companyPick = pickCompanyWinner(ld.company, domCompany);
  const company = companyPick.value;
  const companyProvenance =
    companyPick.source === 'ld' && ld.company
      ? FIELD_PROVENANCE.json_ld
      : companyPick.source === 'dom' && domCompany
        ? (testid.company ? FIELD_PROVENANCE.testid : FIELD_PROVENANCE.class)
        : FIELD_PROVENANCE.missing;

  const domLocation = testid.location || classes.location || '';
  const location = domLocation || ld.location || '';
  const locationProvenance = domLocation
    ? (testid.location ? FIELD_PROVENANCE.testid : FIELD_PROVENANCE.class)
    : ld.location
      ? FIELD_PROVENANCE.json_ld
      : FIELD_PROVENANCE.missing;

  const datePosted = ld.datePosted || classes.datePosted || null;
  const datePostedProvenance = ld.datePosted
    ? FIELD_PROVENANCE.json_ld
    : classes.datePosted
      ? FIELD_PROVENANCE.class
      : FIELD_PROVENANCE.missing;

  return {
    title,
    company,
    location,
    datePosted,
    description,
    provenance: {
      title: titleProvenance,
      company: companyProvenance,
      location: locationProvenance,
      datePosted: datePostedProvenance,
      description: descriptionProvenance,
    },
  };
}
