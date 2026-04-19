import { ImageResponse } from 'next/og';

export const size = {
  width: 1200,
  height: 630,
};

export const contentType = 'image/png';

export default function OpenGraphImage(): ImageResponse {
  return new ImageResponse(
    <div
      style={{
        display: 'flex',
        height: '100%',
        width: '100%',
        background:
          'linear-gradient(180deg, rgba(246,238,233,1) 0%, rgba(241,229,226,1) 44%, rgba(247,240,235,1) 100%)',
        color: '#32111d',
        fontFamily: 'sans-serif',
        padding: '56px',
      }}
    >
      <div
        style={{
          display: 'flex',
          flex: 1,
          flexDirection: 'column',
          justifyContent: 'space-between',
          border: '2px solid rgba(111, 16, 45, 0.16)',
          background: 'rgba(255, 249, 250, 0.82)',
          boxShadow: '22px 22px 0 rgba(86, 15, 40, 0.08)',
          padding: '52px',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '16px',
          }}
        >
          <div
            style={{
              display: 'flex',
              height: '54px',
              width: '54px',
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: '999px',
              background: 'linear-gradient(180deg, #8e2247 0%, #691733 100%)',
              color: '#fff7f9',
              fontSize: '24px',
              fontWeight: 700,
            }}
          >
            L
          </div>
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '6px',
            }}
          >
            <div
              style={{
                fontSize: '22px',
                letterSpacing: '0.24em',
                textTransform: 'uppercase',
                color: '#8e2247',
                fontWeight: 700,
              }}
            >
              Lumi Coach
            </div>
            <div
              style={{
                fontSize: '24px',
                color: '#603847',
              }}
            >
              AI resume tailoring for LinkedIn job applications
            </div>
          </div>
        </div>

        <div
          style={{
            display: 'flex',
            maxWidth: '860px',
            fontSize: '68px',
            lineHeight: 1,
            letterSpacing: '-0.08em',
            fontWeight: 700,
          }}
        >
          Move fast when the right role opens.
        </div>

        <div
          style={{
            display: 'flex',
            gap: '18px',
            fontSize: '24px',
            color: '#603847',
          }}
        >
          <div
            style={{
              border: '1px solid rgba(111, 16, 45, 0.16)',
              borderRadius: '999px',
              padding: '14px 22px',
              background: 'rgba(255, 255, 255, 0.76)',
            }}
          >
            LinkedIn workflow
          </div>
          <div
            style={{
              border: '1px solid rgba(111, 16, 45, 0.16)',
              borderRadius: '999px',
              padding: '14px 22px',
              background: 'rgba(255, 255, 255, 0.76)',
            }}
          >
            Resume tailoring
          </div>
          <div
            style={{
              border: '1px solid rgba(111, 16, 45, 0.16)',
              borderRadius: '999px',
              padding: '14px 22px',
              background: 'rgba(255, 255, 255, 0.76)',
            }}
          >
            Chrome extension
          </div>
        </div>
      </div>
    </div>,
    size
  );
}
