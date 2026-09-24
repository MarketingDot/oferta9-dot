/* ============================================================
   DOT ENERGY — Oferta 9 · 2 Pouches + Caderno
   ============================================================ */
(function () {
  'use strict';

  /* ---------- Countdown -----------------------------------------
     Tres estados, na ordem em que o visitante os ve:
       1. rodando      conta data-minutes (7) para baixo
       2. is-expired   zerou: "Precisa de mais tempo? Sim"
       3. is-reserved  clicou em Sim, ganhou data-extra-minutes (5)
                       e zerou de novo: "Oferta reservada"

     O estado vai para o sessionStorage. Sem isso um F5 devolveria os
     7 minutos e "reservada" nunca significaria nada -- o visitante
     recarregaria de volta para o comeco.
  ---------------------------------------------------------------- */
  var salebar = document.getElementById('salebar');
  var inline = document.getElementById('timerInline');
  var data = (salebar && salebar.dataset) || {};

  var START_MINUTES = Number(data.minutes) || 7;
  var EXTRA_MINUTES = Number(data.extraMinutes) || 5;
  var STORE_KEY = 'dot-oferta-timer';

  var fields = {};
  document.querySelectorAll('.salebar [data-t]').forEach(function (el) {
    fields[el.dataset.t] = el;
  });

  // sessionStorage lanca em aba anonima / cookies bloqueados: sem ele a
  // pagina continua funcionando, so perde a memoria entre recargas.
  function load() {
    try {
      var saved = JSON.parse(sessionStorage.getItem(STORE_KEY));
      return saved && typeof saved.deadline === 'number' ? saved : null;
    } catch (e) { return null; }
  }

  function save() {
    try { sessionStorage.setItem(STORE_KEY, JSON.stringify(state)); } catch (e) {}
  }

  var state = load() || { deadline: Date.now() + START_MINUTES * 60000, extended: false };
  save();

  var pad = function (n) { return String(n).padStart(2, '0'); };

  function tick() {
    var left = Math.max(0, state.deadline - Date.now());
    var over = left === 0;

    document.body.classList.toggle('is-expired', over && !state.extended);
    document.body.classList.toggle('is-reserved', over && state.extended);

    var s = Math.floor(left / 1000);
    var parts = { h: Math.floor(s / 3600), m: Math.floor(s / 60) % 60, s: s % 60 };

    Object.keys(parts).forEach(function (k) {
      if (fields[k]) fields[k].textContent = pad(parts[k]);
    });

    if (inline) {
      inline.textContent = pad(parts.h) + ':' + pad(parts.m) + ':' + pad(parts.s);
    }
  }

  document.querySelectorAll('[data-reset-timer]').forEach(function (btn) {
    btn.addEventListener('click', function () {
      if (state.extended) return;   // a prorrogacao e uma so
      state.deadline = Date.now() + EXTRA_MINUTES * 60000;
      state.extended = true;
      save();
      tick();
    });
  });

  tick();
  setInterval(tick, 1000);

  /* ---------- Popup de sabores -----------------------------------
     3 etapas: o sabor do 1o pouch, o do 2o, e os brindes. Um pouch por
     vez, cada um no 2x2 de sempre -- escolher avanca sozinho, a seta
     volta, a barra marca o progresso.

     Repetir o sabor e permitido: os dois radios aceitam o mesmo valor e o
     link soma em TOKEN:2.

     A escolha sai por dois caminhos:
       - data-pagos ("Menta, Citrus") no botao de checkout
       - o link de compra da Yampi, quando o botao tiver data-checkout
  ---------------------------------------------------------------- */
  var modal = document.getElementById('flavorModal');

  if (modal) {
    var sheet    = modal.querySelector('.modal__sheet');
    var titulo   = document.getElementById('modalTitle');
    var voltar   = modal.querySelector('[data-back]');
    var cta      = document.getElementById('modalCta');
    var passos   = [].slice.call(modal.querySelectorAll('.modal__step'));
    var paineis  = [].slice.call(modal.querySelectorAll('.modal__panel'));
    var track    = document.getElementById('modalTrack');
    var picks    = [].slice.call(modal.querySelectorAll('.pick input'));
    var checkout = document.getElementById('checkoutBtn');
    var unlocked = document.getElementById('modalUnlocked');
    var giroImgs = unlocked ? [].slice.call(unlocked.querySelectorAll('img')) : [];
    var giroTimer = null;
    var giroIdx = 0;

    var TITULOS = ['Escolha o 1º pouch', 'Escolha o 2º pouch', 'Você garantiu os brindes'];

    var POUCHES = ['pouch1', 'pouch2'];
    var ULTIMA  = paineis.length;
    var etapa = 1;
    var anterior = null;   // quem tinha o foco antes de abrir

    function escolhido(grupo) {
      return modal.querySelector('input[name="' + grupo + '"]:checked');
    }

    // tudo na mao: os dois pouches escolhidos
    function completo() {
      return POUCHES.every(function (g) { return !!escolhido(g); });
    }

    /* Link de compra da Yampi: /r/TOKEN:QTD,TOKEN:QTD
       Vao as 3 unidades dos contadores mais o pouch gratis, somadas por token:
       o mesmo sabor nos quatro vira TOKEN:4. Os brindes da ultima etapa entram
       aqui so se ganharem um data-yampi; hoje estao sem token de proposito,
       porque quem os coloca no pedido e a regra da Yampi, nao o link. O cupom
       sai do data-promocode do botao (vazio = sem cupom), e as utm_* do anuncio
       vao junto para a Yampi atribuir a venda a campanha. */
    var brindes = [].slice.call(modal.querySelectorAll('.pick-grid--gifts [data-yampi]'));

    function linkYampi(base) {
      var acc = {};
      var ordem = [];

      function soma(token, n) {
        if (!acc[token]) { acc[token] = 0; ordem.push(token); }
        acc[token] += n;
      }

      POUCHES.forEach(function (g) {
        var escolha = escolhido(g);
        if (escolha) soma(escolha.dataset.yampi, 1);   // sabor repetido vira TOKEN:2
      });
      brindes.forEach(function (el) { soma(el.dataset.yampi, 1); });

      var url = new URL(base + ordem.map(function (t) { return t + ':' + acc[t]; }).join(','));
      if (checkout.dataset.promocode) url.searchParams.set('promocode', checkout.dataset.promocode);
      new URLSearchParams(location.search).forEach(function (valor, chave) {
        if (chave.indexOf('utm_') === 0) url.searchParams.set(chave, valor);
      });
      return url.toString();
    }

    function render() {
      titulo.textContent = TITULOS[etapa - 1];
      voltar.hidden = etapa === 1;

      paineis.forEach(function (p) {
        var ativo = Number(p.dataset.step) === etapa;
        // inert em vez de hidden: o painel precisa continuar ocupando coluna
        // no trilho, mas sai do Tab e do leitor de tela quando nao e o da vez
        p.inert = !ativo;
        p.setAttribute('aria-hidden', ativo ? 'false' : 'true');
      });
      passos.forEach(function (p, i) { p.classList.toggle('is-done', i < etapa); });

      // o finalizar aparece assim que a escolha esta completa, em qualquer
      // etapa -- quem volta para trocar um sabor nao precisa andar ate o fim
      // de novo. Na etapa dos brindes ele aparece sempre, que e a tela dela.
      // is-off usa visibility: mantem o elemento ocupando a celula do
      // rodape, para a altura do popup nao mudar entre as 3 telas
      var mostraCta = completo() || etapa === ULTIMA;
      cta.classList.toggle('is-off', !mostraCta);
      cta.inert = !mostraCta;

      if (unlocked) {
        var escondida = mostraCta;
        unlocked.classList.toggle('is-off', escondida);
        unlocked.inert = escondida;
        if (escondida) desligaGiro(); else ligaGiro();
      }

      desliza();

      picks.forEach(function (i) {
        i.parentNode.classList.toggle('is-on', i.checked);
      });

      if (checkout) {
        checkout.dataset.pagos = POUCHES
          .map(function (g) { var e = escolhido(g); return e ? e.dataset.sabor : null; })
          .filter(Boolean)
          .join(', ');

        var base = checkout.dataset.checkout;
        // so monta o link com os dois sabores escolhidos: link pela metade
        // leva carrinho pela metade
        if (base && completo()) {
          try { checkout.href = linkYampi(base); } catch (e) {}
        }
      }
    }

    /* rodizio das miniaturas: uma de cada vez.
       O timer so roda com a barra a vista -- nao ha porque girar imagem
       em popup fechado ou na etapa dos brindes.                          */
    function pintaGiro() {
      giroImgs.forEach(function (img, i) { img.classList.toggle('is-on', i === giroIdx); });
    }

    function ligaGiro() {
      if (giroTimer || giroImgs.length < 2) return;
      pintaGiro();
      giroTimer = setInterval(function () {
        giroIdx = (giroIdx + 1) % giroImgs.length;
        pintaGiro();
      }, 1700);
    }

    function desligaGiro() {
      clearInterval(giroTimer);
      giroTimer = null;
    }

    function desliza(px) {
      var base = -(etapa - 1) * 100;
      track.style.transform = px
        ? 'translateX(calc(' + base + '% + ' + px + 'px))'
        : 'translateX(' + base + '%)';
    }

    // ate onde da para avancar: so passa da etapa se ela ja foi respondida
    function limite() {
      for (var i = 0; i < POUCHES.length; i++) {
        if (!escolhido(POUCHES[i])) return i + 1;
      }
      return ULTIMA;
    }

    function ir(n) {
      etapa = Math.min(limite(), Math.max(1, n));
      render();
      sheet.scrollTop = 0;
    }

    function abrir() {
      anterior = document.activeElement;
      modal.hidden = false;
      document.body.style.overflow = 'hidden';
      ir(1);
      // reflow entre o hidden sair e a classe entrar, senao nao ha transicao
      void modal.offsetWidth;
      modal.classList.add('is-open');
      var alvo = modal.querySelector('.modal__panel[data-step="1"] .pick input') || cta;
      if (alvo) alvo.focus();
    }

    function fechar() {
      modal.classList.remove('is-open');
      desligaGiro();
      document.body.style.overflow = '';
      if (anterior && anterior.focus) anterior.focus();

      // so esconde quando a animacao termina; o timer cobre o caso de o
      // transitionend nao disparar (aba em segundo plano, motion reduzido)
      var pronto = false;
      var esconde = function () {
        if (pronto) return;
        pronto = true;
        if (!modal.classList.contains('is-open')) modal.hidden = true;
      };
      sheet.addEventListener('transitionend', esconde, { once: true });
      setTimeout(esconde, 340);
    }

    /* ---- arraste horizontal para trocar de sabor ----
       Nao usei o Swiper da pagina de proposito: aqui o avanco depende de o
       sabor ter sido escolhido, e mandar no allowSlideNext dele daria mais
       codigo do que o gesto inteiro.                                        */
    var x0 = null, y0 = null, dx = 0, arrastando = false;

    track.addEventListener('pointerdown', function (e) {
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      x0 = e.clientX; y0 = e.clientY; dx = 0; arrastando = false;
    });

    track.addEventListener('pointermove', function (e) {
      if (x0 === null) return;
      var mx = e.clientX - x0;
      var my = e.clientY - y0;

      // so vira arraste depois de 8px e se for mais horizontal que vertical,
      // senao rouba a rolagem da folha
      if (!arrastando) {
        if (Math.abs(mx) < 8 || Math.abs(mx) <= Math.abs(my)) return;
        arrastando = true;
        track.classList.add('is-dragging');
        track.setPointerCapture(e.pointerId);
      }

      dx = mx;
      // resistencia nas pontas, para o gesto avisar que nao tem para onde ir
      if ((etapa === 1 && dx > 0) || (etapa >= limite() && dx < 0)) dx *= .25;
      desliza(dx);
    });

    function soltar() {
      if (x0 === null) return;
      var largura = track.offsetWidth || 1;
      var passou = Math.abs(dx) > Math.min(70, largura * .18);

      if (arrastando && passou) ir(etapa + (dx < 0 ? 1 : -1));
      else desliza();

      track.classList.remove('is-dragging');
      x0 = null; y0 = null; dx = 0;
      setTimeout(function () { arrastando = false; }, 0);
    }

    track.addEventListener('pointerup', soltar);
    track.addEventListener('pointercancel', soltar);

    // um arraste que terminou em cima de um cartao nao pode virar escolha
    track.addEventListener('click', function (e) {
      if (arrastando) { e.preventDefault(); e.stopPropagation(); }
    }, true);

    modal.addEventListener('change', render);

    // escolher avanca sozinho -- o atraso deixa o selo aparecer antes de trocar.
    // Vai no click do input, e nao no change: quem volta do checkout encontra os
    // sabores restaurados pelo navegador, e clicar de novo no sabor que ja estava
    // marcado nao dispara change -- a pessoa ficava presa na etapa. O clique no
    // cartao (label) chega aqui como um click no input, entao conta uma vez so.
    modal.addEventListener('click', function (e) {
      var input = e.target;
      if (!input.matches || !input.matches('.pick input')) return;
      render();
      setTimeout(function () { if (!modal.hidden) ir(etapa + 1); }, 320);
    });

    cta.addEventListener('click', function () {
      // navega pela URL, nao por checkout.click(): aquele botao abre o
      // popup, entao clicar nele aqui reabriria tudo na etapa 1
      if (completo()) {
        var destino = checkout && checkout.getAttribute('href');
        if (destino && destino !== '#') location.href = destino;
        return;
      }
      if (etapa < ULTIMA && etapa > limite()) return;
      if (etapa < ULTIMA) ir(etapa + 1);
    });

    voltar.addEventListener('click', function () { ir(etapa - 1); });

    modal.querySelectorAll('[data-close]').forEach(function (el) {
      el.addEventListener('click', fechar);
    });

    // o input real esta fora da tela, entao o anel de foco vai no cartao --
    // so com :focus-visible. Ao abrir o popup pelo mouse o foco vai para o 1o
    // sabor, e o anel sempre aceso parecia que a menta estava escolhida.
    function focoVisivel(el) {
      try { return el.matches(':focus-visible'); } catch (e) { return true; }
    }

    picks.forEach(function (input) {
      input.addEventListener('focus', function () { if (focoVisivel(input)) input.parentNode.classList.add('has-focus'); });
      input.addEventListener('blur',  function () { input.parentNode.classList.remove('has-focus'); });
    });

    document.addEventListener('keydown', function (e) {
      if (modal.hidden) return;

      if (e.key === 'Escape') { fechar(); return; }
      if (e.key !== 'Tab') return;

      // prende o foco: sem isso o Tab passeia pela pagina atras do overlay
      var focaveis = [].slice.call(
        sheet.querySelectorAll('button, [href], input:not([hidden])')
      ).filter(function (el) { return el.offsetParent !== null || el.tagName === 'INPUT'; });

      if (!focaveis.length) return;
      var primeiro = focaveis[0];
      var ultimo = focaveis[focaveis.length - 1];

      if (e.shiftKey && document.activeElement === primeiro) { e.preventDefault(); ultimo.focus(); }
      else if (!e.shiftKey && document.activeElement === ultimo) { e.preventDefault(); primeiro.focus(); }
    });

    // os dois CTAs da pagina sempre abrem o popup -- o do card e o do fim da
    // secao de beneficios. Quem leva para a Yampi e so o Finalizar compra.
    // Pular direto para o checkout quando os sabores ja estavam marcados
    // quebrava na volta do checkout: o navegador restaura os radios mas nao o
    // link, e o clique caia no href="#" sem abrir nada.
    document.querySelectorAll('[data-open-flavors]').forEach(function (btn) {
      btn.addEventListener('click', function (e) {
        e.preventDefault();
        abrir();
      });
    });

    render();
  }

  /* ---------- Rodizio de sabores nos pouches do card --------------
     As 4 imagens de cada pouch ficam empilhadas e uma aparece por vez, para
     mostrar que o sabor e escolha da pessoa. Cada miniatura anda um sabor a
     frente da anterior (o + n), entao as duas nunca mostram o mesmo pouch.
     So gira com a caixa a vista, e nao gira para quem pediu menos movimento.
  ---------------------------------------------------------------- */
  var pouchGiro = [].slice.call(document.querySelectorAll('.gift-list__img--giro'));
  var menosMovimento = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  if (pouchGiro.length && !menosMovimento && 'IntersectionObserver' in window) {
    var pouchIdx = 0;
    var pouchTimer = null;

    var giraPouches = function () {
      pouchIdx++;
      pouchGiro.forEach(function (caixa, n) {
        var imgs = caixa.children;
        for (var i = 0; i < imgs.length; i++) {
          imgs[i].classList.toggle('is-on', i === (pouchIdx + n) % imgs.length);
        }
      });
    };

    new IntersectionObserver(function (entries) {
      var avista = entries[entries.length - 1].isIntersecting;
      if (avista && !pouchTimer) pouchTimer = setInterval(giraPouches, 1700);
      if (!avista && pouchTimer) { clearInterval(pouchTimer); pouchTimer = null; }
    }).observe(pouchGiro[0].closest('.gifts-box') || pouchGiro[0]);
  }

  /* ---------- Carrosséis ----------------------------------------- */
  if (typeof Swiper === 'undefined') return;

  // O navegador arrasta <img> nativamente e isso engole o swipe no desktop.
  document.querySelectorAll('.swiper img').forEach(function (img) {
    img.draggable = false;
    img.addEventListener('dragstart', function (e) { e.preventDefault(); });
  });

  // Galeria do produto: principal + miniaturas (5 por vez, como na RYZE)
  var thumbs = new Swiper('#galleryThumbs', {
    slidesPerView: 5,
    spaceBetween: 8,
    watchSlidesProgress: true,
    slideToClickedSlide: true
  });

  new Swiper('#galleryMain', {
    slidesPerView: 1,
    spaceBetween: 0,
    grabCursor: true,
    watchOverflow: true,
    keyboard: { enabled: true, onlyInViewport: true },
    navigation: { prevEl: '#galleryPrev', nextEl: '#galleryNext' },
    thumbs: { swiper: thumbs }
  });

  // Brindes: só roda abaixo de 992px (acima o CSS mostra o grid)
  var giftsSwiper = null;

  function syncGifts() {
    var isMobile = window.matchMedia('(max-width: 991px)').matches;

    if (isMobile && !giftsSwiper) {
      giftsSwiper = new Swiper('#giftsSwiper', {
        slidesPerView: 1.6,
        spaceBetween: 8,
        centeredSlides: true,
        grabCursor: true,
        watchOverflow: true,
        keyboard: { enabled: true, onlyInViewport: true },
        pagination: { el: '#giftsDots', clickable: true }
      });
    } else if (!isMobile && giftsSwiper) {
      giftsSwiper.destroy(true, true);
      giftsSwiper = null;
    }
  }

  syncGifts();
  window.addEventListener('resize', syncGifts);
})();
