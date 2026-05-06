import React from 'react';
import { Mail, Phone, MapPin, Globe, Linkedin, Github } from 'lucide-react';
import type {
  ResumeData,
  ResumeSectionHeadings,
  ResumeFallbackLabels,
} from '@/components/dashboard/resume-component';
import { getSortedSections, getSectionMeta } from '@/lib/utils/section-helpers';
import { formatDateRange } from '@/lib/utils';
import { type DateDisplayMode, type ExperienceHeaderOrder } from '@/lib/types/template-settings';
import { DynamicResumeSection } from './dynamic-resume-section';
import { SafeHtml } from './safe-html';
import { buildContactDisplay } from './contact-utils';
import { ResumeLinkPill } from './resume-link-pill';
import baseStyles from './styles/_base.module.css';
import styles from './styles/modern-two-column.module.css';

const resumeSectionClass = `${baseStyles['resume-section']} resume-section`;
const accentSectionTitleClass = `${styles.sectionTitleAccent} resume-section-title`;
const accentSectionTitleSmClass = `${baseStyles['resume-section-title-sm']} resume-section-title-sm text-[var(--resume-accent-primary)]`;
const resumeItemClass = `${baseStyles['resume-item']} resume-item`;

interface ResumeModernTwoColumnProps {
  data: ResumeData;
  showContactIcons?: boolean;
  sectionHeadings?: Partial<ResumeSectionHeadings>;
  fallbackLabels?: Partial<ResumeFallbackLabels>;
  dateDisplay?: DateDisplayMode;
  experienceHeaderOrder?: ExperienceHeaderOrder;
}

/**
 * Modern Two-Column Resume Template
 *
 * Two-column layout with modern colorful accents and customizable theme colors.
 * Combines the efficiency of two-column layout with vibrant modern design.
 *
 * Main Column (65%): Summary, Experience, Projects, Certifications/Training, Custom Sections
 * Sidebar (35%): Education, Skills, Languages, Awards, Links
 *
 * Best for professionals who want modern aesthetics with space-efficient layout.
 */
export const ResumeModernTwoColumn: React.FC<ResumeModernTwoColumnProps> = ({
  data,
  showContactIcons = false,
  sectionHeadings,
  fallbackLabels,
  dateDisplay = 'month-year',
  experienceHeaderOrder = 'company-first',
}) => {
  const { personalInfo, summary, workExperience, education, personalProjects, additional } = data;

  // Get sorted visible sections
  const sortedSections = getSortedSections(data);

  // Get all sections (including hidden) for visibility checks
  const allSections = getSectionMeta(data);

  const headingFallbacks: ResumeSectionHeadings = {
    summary: sectionHeadings?.summary ?? 'Summary',
    experience: sectionHeadings?.experience ?? 'Experience',
    education: sectionHeadings?.education ?? 'Education',
    projects: sectionHeadings?.projects ?? 'Projects',
    certifications: sectionHeadings?.certifications ?? 'Training & Certifications',
    skills: sectionHeadings?.skills ?? 'Skills',
    languages: sectionHeadings?.languages ?? 'Languages',
    awards: sectionHeadings?.awards ?? 'Awards',
    links: sectionHeadings?.links ?? 'Links',
  };

  const nameFallback = fallbackLabels?.name ?? 'Your Name';

  // Get section display name from metadata
  const getSectionDisplayName = (sectionKey: string, fallback: string): string => {
    const section = sortedSections.find((s) => s.key === sectionKey);
    return section?.displayName || fallback;
  };

  // Check if a section is visible (use allSections, not sortedSections)
  const isSectionVisible = (sectionKey: string): boolean => {
    const section = allSections.find((s) => s.key === sectionKey);
    return section?.isVisible ?? true;
  };

  // Get custom sections (non-default)
  const customSections = sortedSections.filter((s) => !s.isDefault);

  // Icon mapping for contact types
  const contactIcons: Record<string, React.ReactNode> = {
    Email: <Mail size={12} />,
    Phone: <Phone size={12} />,
    Location: <MapPin size={12} />,
    Website: <Globe size={12} />,
    LinkedIn: <Linkedin size={12} />,
    GitHub: <Github size={12} />,
  };

  // Helper function to render contact details
  const renderContactDetail = (label: string, value?: string | null, hrefPrefix: string = '') => {
    if (!value) return null;
    const { href, isLink, displayText, socialSlug, resolvedLabel } = buildContactDisplay(
      label,
      value,
      hrefPrefix
    );

    return (
      <span className="inline-flex items-center gap-1">
        {showContactIcons && contactIcons[resolvedLabel]}
        {socialSlug ? (
          <>
            <span style={{ color: 'var(--resume-text-primary)' }}>{resolvedLabel}: </span>
            <a
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className={`${baseStyles['resume-link']} hover:underline`}
            >
              {socialSlug}
            </a>
          </>
        ) : isLink ? (
          <a
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            className={`${baseStyles['resume-link']} hover:underline`}
          >
            {displayText}
          </a>
        ) : (
          <span style={{ color: 'var(--resume-text-primary)' }}>{displayText}</span>
        )}
      </span>
    );
  };

  const renderExperienceHeader = (exp: NonNullable<ResumeData['workExperience']>[number]) => {
    const isCompanyFirst = experienceHeaderOrder === 'company-first';
    const companyLocation = [exp.company, exp.location].filter(Boolean).join(' • ');
    const companyTextClass = isCompanyFirst
      ? baseStyles['resume-item-title-sm']
      : baseStyles['resume-item-subtitle-sm'];
    const roleTextClass = isCompanyFirst
      ? baseStyles['resume-item-subtitle-sm']
      : baseStyles['resume-item-title-sm'];
    const roleDateClass = isCompanyFirst
      ? `${baseStyles['resume-date']} ${baseStyles['resume-item-subtitle-sm']} ml-4`
      : `${baseStyles['resume-date']} ml-4`;
    const roleRow = (
      <div className={`flex justify-between items-baseline ${baseStyles['resume-row-tight']}`}>
        <h4 className={roleTextClass}>{exp.title}</h4>
        <span className={roleDateClass}>{formatDateRange(exp.years, { dateDisplay })}</span>
      </div>
    );
    const companyRow = (
      <div
        className={`flex justify-between items-center ${baseStyles['resume-row-tight']} ${companyTextClass}`}
      >
        <span className="inline-flex flex-wrap items-center gap-x-1.5 gap-y-1">
          {companyLocation && <span>{companyLocation}</span>}
          <ResumeLinkPill value={exp.website} kind="website" iconSize={9} />
        </span>
      </div>
    );
    const contextRow = exp.context ? (
      <p className={baseStyles['resume-item-context']}>{exp.context}</p>
    ) : null;

    if (isCompanyFirst) {
      return (
        <>
          {companyRow}
          {contextRow}
          {roleRow}
        </>
      );
    }

    return (
      <>
        {roleRow}
        {companyRow}
        {contextRow}
      </>
    );
  };

  return (
    <>
      {/* Header */}
      <div className={baseStyles['resume-header']}>
        <h1 className={`${baseStyles['resume-name']} ${styles.nameAccent}`}>
          {personalInfo?.name || nameFallback}
        </h1>
        {personalInfo?.title && (
          <div className={`${baseStyles['resume-title']} mt-1`}>{personalInfo.title}</div>
        )}
        {personalInfo && (
          <div
            className={`${baseStyles['resume-contact-line']} flex flex-wrap gap-x-3 gap-y-1 mt-1`}
          >
            {renderContactDetail('CustomTagline', personalInfo.customTagline)}
            {renderContactDetail('Email', personalInfo.email, 'mailto:')}
            {renderContactDetail('Phone', personalInfo.phone, 'tel:')}
            {renderContactDetail('Location', personalInfo.location)}
            {renderContactDetail('Website', personalInfo.website)}
            {renderContactDetail('LinkedIn', personalInfo.linkedin)}
            {renderContactDetail('GitHub', personalInfo.github)}
          </div>
        )}
      </div>

      {/* Two-Column Grid */}
      <div className={styles.grid}>
        {/* Main Column - Left */}
        <div className={styles.mainColumn}>
          {/* Summary Section */}
          {isSectionVisible('summary') && summary && (
            <div className={resumeSectionClass}>
              <h3 className={accentSectionTitleClass}>
                {getSectionDisplayName('summary', headingFallbacks.summary)}
              </h3>
              <p className={`text-justify ${baseStyles['resume-text']}`}>{summary}</p>
            </div>
          )}

          {/* Experience Section */}
          {isSectionVisible('workExperience') && workExperience && workExperience.length > 0 && (
            <div className={resumeSectionClass}>
              <h3 className={accentSectionTitleClass}>
                {getSectionDisplayName('workExperience', headingFallbacks.experience)}
              </h3>
              <div className={baseStyles['resume-items']}>
                {workExperience.map((exp) => (
                  <div key={exp.id} className={resumeItemClass}>
                    {renderExperienceHeader(exp)}

                    {exp.description && exp.description.length > 0 && (
                      <ul
                        className={`ml-4 ${baseStyles['resume-list']} ${baseStyles['resume-text-xs']}`}
                      >
                        {exp.description.map((desc, index) => (
                          <li key={index} className="flex">
                            <span className="mr-1.5 flex-shrink-0">•&nbsp;</span>
                            <span>
                              <SafeHtml html={desc} />
                            </span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Projects Section */}
          {isSectionVisible('personalProjects') &&
            personalProjects &&
            personalProjects.length > 0 && (
              <div className={resumeSectionClass}>
                <h3 className={accentSectionTitleClass}>
                  {getSectionDisplayName('personalProjects', headingFallbacks.projects)}
                </h3>
                <div className={baseStyles['resume-items']}>
                  {personalProjects.map((project) => (
                    <div key={project.id} className={resumeItemClass}>
                      <div
                        className={`flex justify-between items-baseline ${baseStyles['resume-row-tight']}`}
                      >
                        <div className="flex items-baseline gap-1.5">
                          <h4 className={baseStyles['resume-item-title-sm']}>{project.name}</h4>
                          {(project.github || project.website) && (
                            <span className="flex gap-1">
                              <ResumeLinkPill value={project.github} kind="github" iconSize={9} />
                              <ResumeLinkPill value={project.website} kind="website" iconSize={9} />
                            </span>
                          )}
                        </div>
                        {project.years && (
                          <span className={`${baseStyles['resume-date']} ml-2`}>
                            {formatDateRange(project.years, { dateDisplay })}
                          </span>
                        )}
                      </div>
                      {project.role && (
                        <div
                          className={`${baseStyles['resume-row-tight']} ${baseStyles['resume-item-subtitle-sm']}`}
                        >
                          <span>{project.role}</span>
                        </div>
                      )}
                      {project.description && project.description.length > 0 && (
                        <ul
                          className={`ml-4 ${baseStyles['resume-list']} ${baseStyles['resume-text-xs']}`}
                        >
                          {project.description.map((desc, index) => (
                            <li key={index} className="flex">
                              <span className="mr-1.5 flex-shrink-0">•&nbsp;</span>
                              <span>
                                <SafeHtml html={desc} />
                              </span>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

          {/* Certifications/Training - Main column */}
          {isSectionVisible('additional') &&
            additional?.certificationsTraining &&
            additional.certificationsTraining.length > 0 && (
              <div className={resumeSectionClass}>
                <h3 className={accentSectionTitleClass}>{headingFallbacks.certifications}</h3>
                <ul className={`ml-4 ${baseStyles['resume-list']} ${baseStyles['resume-text-xs']}`}>
                  {additional.certificationsTraining.map((cert, index) => (
                    <li key={index} className="flex">
                      <span className="mr-1.5 flex-shrink-0">•&nbsp;</span>
                      <span>{cert}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

          {/* Custom Sections - Main column */}
          {customSections.map((section) => (
            <DynamicResumeSection key={section.id} sectionMeta={section} resumeData={data} />
          ))}
        </div>

        {/* Sidebar Column - Right */}
        <div className={styles.sidebarColumn}>
          {/* Education Section */}
          {isSectionVisible('education') && education && education.length > 0 && (
            <div className={resumeSectionClass}>
              <h3 className={accentSectionTitleSmClass}>
                {getSectionDisplayName('education', headingFallbacks.education)}
              </h3>
              <div className={baseStyles['resume-stack']}>
                {education.map((edu) => (
                  <div key={edu.id}>
                    <h4
                      className={`${baseStyles['resume-item-title-sm']} ${baseStyles['sidebar-text-wrap']}`}
                    >
                      {edu.institution}
                      {edu.years && (
                        <span
                          className={`font-normal ${baseStyles['resume-date']} ${baseStyles['text-muted']}`}
                        >
                          {' '}
                          | {formatDateRange(edu.years, { dateDisplay })}
                        </span>
                      )}
                    </h4>
                    <p className={baseStyles['resume-item-subtitle-sm']}>{edu.degree}</p>
                    {edu.description && (
                      <ul
                        className={`ml-4 ${baseStyles['resume-list']} ${baseStyles['resume-text-xs']} ${baseStyles['resume-meta']}`}
                      >
                        <li className="flex">
                          <span className="mr-1.5 flex-shrink-0">•&nbsp;</span>
                          <span>
                            <SafeHtml html={edu.description} />
                          </span>
                        </li>
                      </ul>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Skills Section */}
          {isSectionVisible('additional') &&
            additional?.technicalSkills &&
            additional.technicalSkills.length > 0 && (
              <div className={resumeSectionClass}>
                <h3 className={accentSectionTitleSmClass}>{headingFallbacks.skills}</h3>
                <div className="flex flex-wrap gap-1">
                  {additional.technicalSkills.map((skill, index) => (
                    <span key={index} className={baseStyles['resume-skill-pill']}>
                      {skill}
                    </span>
                  ))}
                </div>
              </div>
            )}

          {/* Languages Section */}
          {isSectionVisible('additional') &&
            additional?.languages &&
            additional.languages.length > 0 && (
              <div className={resumeSectionClass}>
                <h3 className={accentSectionTitleSmClass}>{headingFallbacks.languages}</h3>
                <p className={baseStyles['resume-text-xs']}>{additional.languages.join(' • ')}</p>
              </div>
            )}

          {/* Awards Section */}
          {isSectionVisible('additional') && additional?.awards && additional.awards.length > 0 && (
            <div className={resumeSectionClass}>
              <h3 className={accentSectionTitleSmClass}>{headingFallbacks.awards}</h3>
              <ul className={baseStyles['resume-list']}>
                {additional.awards.map((award, index) => (
                  <li key={index} className={baseStyles['resume-text-xs']}>
                    {award}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Links Section */}
          {personalInfo &&
            (personalInfo.website || personalInfo.linkedin || personalInfo.github) && (
              <div className={resumeSectionClass}>
                <h3 className={accentSectionTitleSmClass}>{headingFallbacks.links}</h3>
                <div
                  className={`${baseStyles['resume-stack-tight']} ${baseStyles['resume-meta-sm']}`}
                >
                  {personalInfo.linkedin && (
                    <div>{renderContactDetail('LinkedIn', personalInfo.linkedin)}</div>
                  )}
                  {personalInfo.github && (
                    <div>{renderContactDetail('GitHub', personalInfo.github)}</div>
                  )}
                  {personalInfo.website && (
                    <div>{renderContactDetail('Website', personalInfo.website)}</div>
                  )}
                </div>
              </div>
            )}
        </div>
      </div>
    </>
  );
};

export default ResumeModernTwoColumn;
