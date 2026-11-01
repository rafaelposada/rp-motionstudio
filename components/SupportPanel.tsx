'use client';
export default function SupportPanel({pt}:{pt:boolean}) {
  return <section className="support-panel">
    <div className="support-profile"><span className="support-profile-mark" aria-hidden="true">RP</span><div><h3>Rafael Posada</h3><p>{pt?'Brand designer · Estratégia e identidade':'Brand designer · Strategy and identity'}</p></div></div>
    <p>{pt?'Sou Rafael Posada, brand designer com mais de 13 anos de experiência em branding. Trabalho com estratégia de marca, identidade visual e presença digital, com foco em advogados e escritórios de advocacia.':'I’m Rafael Posada, a brand designer with over 13 years of experience in branding. I work with brand strategy, visual identity and digital presence, focusing on lawyers and law firms.'}</p>
    <p>{pt?'No RP MotionStudio, conduzo a evolução desta versão para tornar o trabalho criativo mais prático, com ferramentas pensadas para compor, apresentar e dar movimento às ideias.':'At RP MotionStudio, I guide the development of this version to make creative work more practical, with tools for composing, presenting and bringing ideas into motion.'}</p>
    <div className="hairline support-divider"/>
    <h3>{pt?'Apoie o RP MotionStudio':'Support RP MotionStudio'}</h3>
    <p>{pt?'Quer ajudar a melhorar o aplicativo e criar novas soluções? Você pode contribuir com o valor que quiser. Entre em contato para combinar uma forma de apoio.':'Want to help improve the app and create new solutions? Contribute any amount you choose. Get in touch to arrange your support.'}</p>
    <div className="support-callout"><strong>{pt?'Feedback também faz diferença':'Your feedback matters'}</strong><p>{pt?'Envie sugestões, relate bugs ou conte como usa o aplicativo. Para um erro, inclua o que estava fazendo, a versão do app e, se possível, um print. Envie projetos ou mídias apenas se quiser compartilhá-los.':'Send suggestions, report bugs or tell us how you use the app. For a bug, include your steps, app version and a screenshot when possible. Share projects or media only if you choose to.'}</p></div>
    <div className="support-links"><a href="mailto:contato@rafaelposada.com"><span>{pt?'E-mail profissional':'Professional email'}</span><strong>contato@rafaelposada.com ↗</strong></a><a href="https://instagram.com/rafaelposada" target="_blank" rel="noopener noreferrer"><span>Instagram</span><strong>@rafaelposada ↗</strong></a><a href="https://rafaelposada.com" target="_blank" rel="noopener noreferrer"><span>{pt?'Site':'Website'}</span><strong>rafaelposada.com ↗</strong></a></div>
    <p className="ctl-hint">{pt?'Apoio opcional. Nenhuma cobrança ou envio de dados acontece por este menu.':'Support is optional. This panel does not process payments or send your data.'}</p>
  </section>;
}
