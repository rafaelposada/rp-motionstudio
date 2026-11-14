# Controle pelo Claude e pelo Codex (MCP)

Com o conector, o Claude monta composições no RP MotionStudio a partir de um pedido simples: escolhe o formato e o
modelo, coloca fotos e vídeos do computador, escreve os textos, aplica o kit de marca, cria camadas de código (Canvas
2D ou WebGL), confere o resultado por imagem e exporta. Funciona com o app aberto ou fechado: o conector abre o app
em segundo plano, sem janela nem ícone no Dock.

## Conectar

No app: Configurações → Claude. Ali estão o interruptor e os dois comandos prontos para copiar.

Claude Code (uma vez, no Terminal):

```bash
claude mcp add rp-motionstudio -s user -e ELECTRON_RUN_AS_NODE=1 -- "/Applications/RP MotionStudio Desktop.app/Contents/MacOS/RP MotionStudio Desktop" "/Applications/RP MotionStudio Desktop.app/Contents/Resources/app/desktop/mcp-stdio.cjs"
```

App do Claude: copie o bloco `mcpServers` mostrado em Configurações → Claude para o `claude_desktop_config.json`.

Codex: cole no fim de `~/.codex/config.toml` e reabra o Codex:

```toml
[mcp_servers.rp-motionstudio]
command = "/Applications/RP MotionStudio Desktop.app/Contents/MacOS/RP MotionStudio Desktop"
args = ["/Applications/RP MotionStudio Desktop.app/Contents/Resources/app/desktop/mcp-stdio.cjs"]
startup_timeout_sec = 120
tool_timeout_sec = 3600

[mcp_servers.rp-motionstudio.env]
ELECTRON_RUN_AS_NODE = "1"
```

Os mesmos comandos aparecem no pop-up da tela inicial (cartão "Conectar ao app").

## Segurança

- O servidor escuta só em `127.0.0.1:47311` e exige a chave guardada em
  `~/Library/Application Support/RP MotionStudio Desktop/mcp.json` (legível só pelo seu usuário).
- Páginas da internet não conseguem chamá-lo: pedidos com cabeçalho `Origin` são recusados.
- Mídias só entram por caminho absoluto de imagem ou vídeo, com limite de tamanho.
- Camadas de código rodam isoladas, sem internet e sem acesso a arquivos ou ao armazenamento do app.
- Desligar em Configurações → Claude interrompe todas as chamadas.

## Ferramentas

`get_state`, `list_templates`, `list_projects`, `open_project`, `new_project`, `set_composition`, `add_text`,
`add_shape`, `update_layer`, `remove_layer`, `add_media`, `set_code_layer`, `apply_brand_kit`, `snapshot`,
`export_video`, `undo`, `redo`. Cada comando vira um passo de desfazer no editor.
