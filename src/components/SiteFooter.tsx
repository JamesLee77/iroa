interface SiteFooterProps {
  wordmarkUrl: string;
  whitepaperUrl: string;
  photoManifestUrl: string;
}

export function SiteFooter({ wordmarkUrl, whitepaperUrl, photoManifestUrl }: SiteFooterProps) {
  return (
    <footer className="site-footer">
      <div className="site-footer__inner">
        <div className="site-footer__brand">
          <img src={wordmarkUrl} alt="IROA.AI" />
          <p>일상을 이롭게. 필요한 일을 끝까지.</p>
        </div>
        <nav aria-label="문서와 출처">
          <a href={whitepaperUrl} target="_blank" rel="noreferrer">백서</a>
          <a href={photoManifestUrl} target="_blank" rel="noreferrer">사진 출처</a>
          <a href="#safety">안전 원칙</a>
        </nav>
        <p className="site-footer__disclosure">
          이 홈페이지는 IROA의 제품 비전과 기관 파일럿 설계를 설명하는 사전 공개 자료입니다. 사진은 설명을 위한 이미지이며 실제 사용자·제품·제휴기관을 의미하지 않습니다.
        </p>
      </div>
    </footer>
  );
}
