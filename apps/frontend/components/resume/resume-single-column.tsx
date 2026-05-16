import React from 'react';
import { Mail, Phone, MapPin, Globe, Linkedin, Github } from 'lucide-react';
import type {
  ResumeData,
  SectionMeta,
  AdditionalSectionLabels,
} from '@/components/dashboard/resume-component';
import { getSortedSections } from '@/lib/utils/section-helpers';
import { formatDateRange } from '@/lib/utils';
import { type DateDisplayMode, type ExperienceHeaderOrder } from '@/lib/types/template-settings';
import { DynamicResumeSection } from './dynamic-resume-section';
import { SafeHtml } from './safe-html';
import { buildContactDisplay } from './contact-utils';
import { ResumeLinkPill } from './resume-link-pill';
import baseStyles from './styles/_base.module.css';
import styles from './styles/swiss-single.module.css';

const resumeSectionClass = `${baseStyles['resume-section']} resume-section`;
const resumeSectionTitleClass = `${baseStyles['resume-section-title']} resume-section-title`;
const resumeItemClass = `${baseStyles['resume-item']} resume-item`;

interface ResumeSingleColumnProps {
  data: ResumeData;
  showContactIcons?: boolean;
  additionalSectionLabels?: Partial<AdditionalSectionLabels>;
  dateDisplay?: DateDisplayMode;
  experienceHeaderOrder?: ExperienceHeaderOrder;
}

/**
 * Swiss Single-Column Resume Template
 *
 * Traditional full-width layout with sections stacked vertically.
 * Best for detailed experience descriptions and maximum content density.
 *
 * Section order: Determined by sectionMeta ordering
 */
export const ResumeSingleColumn: React.FC<ResumeSingleColumnProps> = ({
  data,
  showContactIcons = false,
  additionalSectionLabels,
  dateDisplay = 'month-year',
  experienceHeaderOrder = 'company-first',
}) => {
  const { personalInfo, summary, workExperience, education, personalProjects, additional } = data;

  // Get sorted visible sections
  const sortedSections = getSortedSections(data);

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
    const companyTextClass = isCompanyFirst
      ? baseStyles['resume-item-title']
      : baseStyles['resume-item-subtitle'];
    const roleTextClass = isCompanyFirst
      ? baseStyles['resume-item-subtitle']
      : baseStyles['resume-item-title'];
    const roleDateClass = isCompanyFirst
      ? `${baseStyles['resume-date']} ${baseStyles['resume-item-subtitle']} ml-4`
      : `${baseStyles['resume-date']} ml-4`;
    const roleRow = (
      <div className={`flex justify-between items-baseline ${baseStyles['resume-row-tight']}`}>
        <h4 className={roleTextClass}>{exp.title}</h4>
        <span className={roleDateClass}>{formatDateRange(exp.years, { dateDisplay })}</span>
      </div>
    );
    const companyRow = (
      <div
        className={`flex justify-between items-center ${isCompanyFirst ? baseStyles['resume-row-tight'] : baseStyles['resume-row']} ${companyTextClass}`}
      >
        <span className="inline-flex flex-wrap items-center gap-x-1.5 gap-y-1">
          {exp.company && <span>{exp.company}</span>}
          <ResumeLinkPill value={exp.website} kind="website" />
        </span>
        {exp.location && <span>{exp.location}</span>}
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

  // Render a section based on its key
  const renderSection = (section: SectionMeta) => {
    switch (section.key) {
      case 'personalInfo':
        // Personal info is the header - handled separately
        return null;

      case 'summary':
        if (!summary) return null;
        return (
          <div key={section.id} className={resumeSectionClass}>
            <h3 className={resumeSectionTitleClass}>{section.displayName}</h3>
            <p className={`text-justify ${baseStyles['resume-text']}`}>{summary}</p>
          </div>
        );

      case 'workExperience':
        if (!workExperience || workExperience.length === 0) return null;
        return (
          <div key={section.id} className={resumeSectionClass}>
            <h3 className={resumeSectionTitleClass}>{section.displayName}</h3>
            <div className={baseStyles['resume-items']}>
              {workExperience.map((exp) => (
                <div key={exp.id} className={resumeItemClass}>
                  {renderExperienceHeader(exp)}
                  {exp.description && exp.description.length > 0 && (
                    <ul
                      className={`ml-4 ${baseStyles['resume-list']} ${baseStyles['resume-text-sm']}`}
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
        );

      case 'personalProjects':
        if (!personalProjects || personalProjects.length === 0) return null;
        return (
          <div key={section.id} className={resumeSectionClass}>
            <h3 className={resumeSectionTitleClass}>{section.displayName}</h3>
            <div className={baseStyles['resume-items']}>
              {personalProjects.map((project) => (
                <div key={project.id} className={resumeItemClass}>
                  <div
                    className={`flex justify-between items-baseline ${baseStyles['resume-row-tight']}`}
                  >
                    <div className="flex items-baseline gap-2">
                      <h4 className={baseStyles['resume-item-title']}>{project.name}</h4>
                      {(project.github || project.website) && (
                        <span className="flex gap-1.5">
                          <ResumeLinkPill value={project.github} kind="github" />
                          <ResumeLinkPill value={project.website} kind="website" />
                        </span>
                      )}
                    </div>
                    {project.years && (
                      <span className={`${baseStyles['resume-date']} ml-4`}>
                        {formatDateRange(project.years, { dateDisplay })}
                      </span>
                    )}
                  </div>
                  {project.role && (
                    <div
                      className={`${baseStyles['resume-row']} ${baseStyles['resume-item-subtitle']}`}
                    >
                      <span>{project.role}</span>
                    </div>
                  )}
                  {project.description && project.description.length > 0 && (
                    <ul
                      className={`ml-4 ${baseStyles['resume-list']} ${baseStyles['resume-text-sm']}`}
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
        );

      case 'education':
        if (!education || education.length === 0) return null;
        return (
          <div key={section.id} className={resumeSectionClass}>
            <h3 className={resumeSectionTitleClass}>{section.displayName}</h3>
            <div className={baseStyles['resume-items']}>
              {education.map((edu) => (
                <div key={edu.id} className={resumeItemClass}>
                  <div
                    className={`flex justify-between items-baseline ${baseStyles['resume-row-tight']}`}
                  >
                    <h4 className={baseStyles['resume-item-title']}>{edu.institution}</h4>
                    <span className={`${baseStyles['resume-date']} ml-4`}>
                      {formatDateRange(edu.years, { dateDisplay })}
                    </span>
                  </div>
                  <div
                    className={`flex justify-between ${baseStyles['resume-item-subtitle']} ${baseStyles['resume-row-tight']}`}
                  >
                    <span>{edu.degree}</span>
                  </div>
                  {edu.description && (
                    <ul
                      className={`ml-4 ${baseStyles['resume-list']} ${baseStyles['resume-text-sm']}`}
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
        );

      case 'additional':
        if (!additional) return null;
        return (
          <AdditionalSection
            key={section.id}
            additional={additional}
            displayName={section.displayName}
            labels={additionalSectionLabels}
          />
        );

      default:
        // Custom section - render using DynamicResumeSection
        if (!section.isDefault) {
          return <DynamicResumeSection key={section.id} sectionMeta={section} resumeData={data} />;
        }
        return null;
    }
  };

  return (
    <div className={styles.container}>
      {/* Header Section - Centered Layout (always first) */}
      {personalInfo && (
        <header
          className={`text-center ${baseStyles['resume-header']} border-b`}
          style={{ borderColor: 'var(--resume-border-primary)' }}
        >
          {/* Name - Centered */}
          {personalInfo.name && (
            <h1 className={`${baseStyles['resume-name']} tracking-tight uppercase mb-1`}>
              {personalInfo.name}
            </h1>
          )}

          {/* Title - Centered, below name */}
          {personalInfo.title && (
            <h2 className={`${baseStyles['resume-title']} tracking-wide uppercase mb-1`}>
              {personalInfo.title}
            </h2>
          )}

          {/* Contact - Own line, centered */}
          <div
            className={`flex flex-wrap justify-center gap-x-1 gap-y-1 ${baseStyles['resume-contact-line']}`}
          >
            {personalInfo.customTagline &&
              renderContactDetail('CustomTagline', personalInfo.customTagline)}
            {personalInfo.email && (
              <>
                {personalInfo.customTagline && <span className={baseStyles['text-muted']}>|</span>}
                {renderContactDetail('Email', personalInfo.email, 'mailto:')}
              </>
            )}
            {personalInfo.phone && (
              <>
                <span className={baseStyles['text-muted']}>|</span>
                {renderContactDetail('Phone', personalInfo.phone, 'tel:')}
              </>
            )}
            {personalInfo.location && (
              <>
                <span className={baseStyles['text-muted']}>|</span>
                {renderContactDetail('Location', personalInfo.location)}
              </>
            )}
            {personalInfo.website && (
              <>
                <span className={baseStyles['text-muted']}>|</span>
                {renderContactDetail('Website', personalInfo.website)}
              </>
            )}
            {personalInfo.linkedin && (
              <>
                <span className={baseStyles['text-muted']}>|</span>
                {renderContactDetail('LinkedIn', personalInfo.linkedin)}
              </>
            )}
            {personalInfo.github && (
              <>
                <span className={baseStyles['text-muted']}>|</span>
                {renderContactDetail('GitHub', personalInfo.github)}
              </>
            )}
          </div>
        </header>
      )}

      {/* Render sections in order based on sectionMeta */}
      {sortedSections
        .filter((section) => section.key !== 'personalInfo')
        .map((section) => renderSection(section))}
    </div>
  );
};

/**
 * Additional info section (skills, languages, certifications, awards)
 */
const AdditionalSection: React.FC<{
  additional: ResumeData['additional'];
  displayName?: string;
  labels?: Partial<AdditionalSectionLabels>;
}> = ({ additional, displayName = 'Skills & Awards', labels }) => {
  if (!additional) return null;

  const {
    technicalSkills = [],
    languages = [],
    certificationsTraining = [],
    awards = [],
  } = additional;

  const mergedLabels: AdditionalSectionLabels = {
    technicalSkills: labels?.technicalSkills ?? 'Technical Skills:',
    languages: labels?.languages ?? 'Languages:',
    certifications: labels?.certifications ?? 'Certifications:',
    awards: labels?.awards ?? 'Awards:',
  };

  const hasContent =
    technicalSkills.length > 0 ||
    languages.length > 0 ||
    certificationsTraining.length > 0 ||
    awards.length > 0;

  if (!hasContent) return null;

  return (
    <div className={resumeSectionClass}>
      <h3 className={resumeSectionTitleClass}>{displayName}</h3>
      <div className={`${baseStyles['resume-stack']} ${baseStyles['resume-text-sm']}`}>
        {technicalSkills.length > 0 && (
          <div className="flex">
            <span className="font-bold w-32 shrink-0">{mergedLabels.technicalSkills}</span>
            <span>{technicalSkills.join(', ')}</span>
          </div>
        )}
        {languages.length > 0 && (
          <div className="flex">
            <span className="font-bold w-32 shrink-0">{mergedLabels.languages}</span>
            <span>{languages.join(', ')}</span>
          </div>
        )}
        {certificationsTraining.length > 0 && (
          <div className="flex">
            <span className="font-bold w-32 shrink-0">{mergedLabels.certifications}</span>
            <span>{certificationsTraining.join(', ')}</span>
          </div>
        )}
        {awards.length > 0 && (
          <div className="flex">
            <span className="font-bold w-32 shrink-0">{mergedLabels.awards}</span>
            <span>{awards.join(', ')}</span>
          </div>
        )}
      </div>
    </div>
  );
};

export default ResumeSingleColumn;
