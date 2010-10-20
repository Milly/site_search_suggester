/****************************

Site Search Suggester
September 21, 2010
Copyright (c) 2010 Milly
http://d.hatena.ne.jp/MillyC/

Released under a Creative Commons License BY 3.0
http://creativecommons.org/licenses/by/3.0/

*****************************/

// ==UserScript==
// @name           Site Search Suggester
// @namespace      http://d.hatena.ne.jp/MillyC/
// @description    Add suggestion to site search such as ruby-lang.org, php.net, smarty.net.
// @include        http://www.ruby-lang.org/*
// @include        http://*.php.net/*
// @include        http://www.smarty.net/*
// @resource       jQuery http://ajax.googleapis.com/ajax/libs/jquery/1.3/jquery.min.js
// ==/UserScript==

(function(win) {

var $ = win.jQuery,
    has_JSON = 'undefined' != typeof JSON,
    has_GM = 'undefined' != typeof GM_getResourceText;

var OPT = {

  MIN_SEARCH_LENGTH: 2,
  MAX_SUGGEST_WORDS: 20,
  LANG: 'ja',
  SITE_SETTINGS: {

  'ruby-lang.org': function() {
    OPT.DICTIONARY_NAME = 'ruby-' + OPT.LANG;
    OPT.DICTIONARY_URL = '/' + OPT.LANG + '/man/html/methodlist.html';
    OPT.DICTIONARY_PARSER = /^<li.*?>([^<>]+)(?:<\/a>|$)/gm;
    OPT.SEARCH_BOX = 'form#search-form input[name="q"]';
  },

  'php.net': function() {
    OPT.DICTIONARY_NAME = 'php-' + OPT.LANG;
    OPT.DICTIONARY_URL = '/manual/' + OPT.LANG + '/indexes.php';
    OPT.DICTIONARY_PARSER = /"indexentry".*>([^<>]+)<\/a>/g;
    OPT.SEARCH_BOX = 'form#topsearch input[name="pattern"]';
  },

  'smarty.net': function() {
    OPT.DICTIONARY_NAME = 'smarty-' + OPT.LANG;
    OPT.DICTIONARY_URL = '/manual/' + OPT.LANG + '/index.php';
    OPT.DICTIONARY_PARSER = /^>([^<>]+)<\/A$/gm;
    OPT.SEARCH_BOX = 'form[action^="/search"] input[name="pattern"]';
    // auto select lang
    $('form[action=""] select[name="trlang"]').val(OPT.LANG);
    $('form[action^="/search"] select[name="show"]').val('manual-' + OPT.LANG).end()
  }

}};

if (!$) {
  load_script(setup_site);
} else {
  setup_site();
}

function load_script(callback) {
  if (has_GM) {
    eval(GM_getResourceText('jQuery'));
    $ = jQuery;
    callback();
    return;
  }

  var org$ = win.$, script = document.createElement('script');
  script.type = 'text/javascript';
  script.src = 'http://ajax.googleapis.com/ajax/libs/jquery/1.3/jquery.min.js';
  document.getElementsByTagName('head')[0].appendChild(script);
  var timer = setInterval(function() {
    if ($ = win.jQuery) {
      win.$ = org$;
      clearInterval(timer);
      callback();
    }
  }, 100);
}

function setup_site() {
  var host = location.host;
  for (var site in OPT.SITE_SETTINGS) {
    if (OPT.SITE_SETTINGS.hasOwnProperty(site) &&
        Math.max(0, host.length - site.length) == host.indexOf(site)) {
      OPT.SITE_SETTINGS[site]();
      setup_suggest();
      break;
    }
  }
}

function setup_suggest() {
  var dictionary = false, suggest_words = false, suggest_cache = {}, empty = [],
      selection = 0, last_selection = 0, last_search_word = false, last_input_word = false,
      search_box = $(OPT.SEARCH_BOX), suggest_box = $('<div id="suggest">');

  load_dictionary(function() {
    setup_style();
    search_box
      .parent().append(suggest_box).end()
      .attr('autocomplete', 'off')
      .keypress(key_handler)
      .keyup(key_handler)
      .blur(function() { setTimeout(hide_suggest_box, 100) });
    suggest_box
      .mousemove(mouse_handler)
      .click(mouse_handler);
  });

  function load_dictionary(callback) {
    var dic_name = 'dictionary-' + OPT.DICTIONARY_NAME;
    dictionary = has_JSON && has_GM && JSON.parse(GM_getValue(dic_name, 'false'));
    if (dictionary) { callback(); return; }

    if (has_GM) {
      GM_xmlhttpRequest({
        method: 'GET',
        url: location.href.replace(/(:\/\/.*?)\/.*/, '$1') + OPT.DICTIONARY_URL,
        onload: function(r) { loaded(r.responseText); }
      });
    } else {
      $.get(OPT.DICTIONARY_URL, null, loaded);
    }
    function loaded(html) {
      dictionary = []
      var reg = new RegExp(OPT.DICTIONARY_PARSER), word, hash = {};
      while (word = (reg.exec(html) || {})[1]) {
        if (!hash[word]) {
          hash[word] = true;
          dictionary.push(word);
        }
      }
      if (dictionary.length) {
        if (has_GM && has_JSON) GM_setValue(dic_name, JSON.stringify(dictionary));
        callback();
      }
    }
  }

  function setup_style() {
    var style = [
      'div#suggest, div#suggest * { margin:0; padding:0; border:none; text-align:left; }',
      'div#suggest { display:none; position:absolute; border:1px solid black; overflow:hidden;',
                    'box-shadow:3px 3px 3px rgba(0,0,0,0.4); -moz-box-shadow:3px 3px 3px rgba(0,0,0,0.4); }',
      'div#suggest ul, div#suggest li { list-style-type:none; }',
      'div#suggest li { padding:0.2em 1em; line-height:1em; background:white; color:black; cursor:default; }',
      'div#suggest li._even { background:#dddddd; }',
      'div#suggest li.select { background:#aaaaff; }'
    ].join('').replace(';', '!important;');

    if (has_GM) {
      GM_addStyle(style);
    } else {
      $('<style>').text(style).appendTo('head');
    }
  }

  function show_suggest_box() {
    if (0 == suggest_words.length) return;
    var li = suggest_box.find('li'),
        pos = search_box.position(),
        width = search_box.outerWidth();
    if (last_selection != selection) {
      last_selection = selection;
      var li = li.removeClass('select');
      if (0 < selection) li.eq(selection - 1).addClass('select');
    }
    suggest_box.show().css({
      left: pos.left, top: pos.top + search_box.outerHeight(),
      minWidth: width, maxWidth: width * 1.8,
      maxHeight: li.outerHeight() * OPT.MAX_SUGGEST_WORDS,
      overflowY: (OPT.MAX_SUGGEST_WORDS < suggest_words.length) ? 'scroll' : ''
    });
  }

  function hide_suggest_box() {
    selection = 0;
    suggest_box.hide();
  }

  function change_selection(new_selection, nochange_text) {
    if ('none' != suggest_box.css('display') && new_selection != selection) {
      var wlen = suggest_words.length;
      selection = new_selection;
      if (wlen < selection)   selection -= wlen + 1;
      else if (selection < 0) selection += wlen + 1;

      if (!nochange_text) {
        if (0 == selection) {
          last_input_word = last_search_word;
        } else {
          last_input_word = suggest_words[selection - 1];
        }
        search_box.val(last_input_word);
      }
    }
    show_suggest_box();
  }

  function update_suggest_box(words) {
    var ul = $('<ul>');
    for (var i = 0; i < words.length; ++i)
      $('<li>').text(words[i]).appendTo(ul);
    ul.find('li:even').addClass('even');
    suggest_box.html('').append(ul);
  }

  function find_suggest_words(search) {
    search = search.toLowerCase();
    if (!suggest_cache[search]) {
      var result = [], darray = [],
          source = suggest_cache[search.substring(0, search.length - 1)] || dictionary;
      if (source.length) {
        for (var i = 0; i < source.length; ++i) {
          var word = source[i], pos = word.toLowerCase().indexOf(search);
          if (0 <= pos) (darray[pos] = darray[pos] || []).push(word);
        }
        for (var i = 0; i < darray.length; ++i)
          if (darray[i]) result = result.concat(darray[i]);
      }
      suggest_cache[search] = (0 == result.length) ? empty :
                              (source.length == result.length) ? source :
                              result;
    }
    return suggest_cache[search];
    return suggest_cache[search].slice(0, OPT.MAX_SUGGEST_WORDS);
  }

  function has_empty_cache(search) {
    var cache = suggest_cache[search.toLowerCase()];
    return cache && 0 == cache.length;
  }

  function key_handler(event) {
    var search_word = search_box.val().replace(/^ +| +$/g, '');
    if (search_word.length < OPT.MIN_SEARCH_LENGTH || has_empty_cache(search_word)) {
      last_input_word = search_word;
      hide_suggest_box();
      return;
    }

    // control
    if ('keypress' == event.type) {
      switch (event.keyCode) {
      case 38: // Up arrow
        change_selection(selection - 1);
        return;
      case 40: // Down arrow
        change_selection(selection + 1);
        return;
      case 27: // ESC
        search_box.val(last_input_word = last_search_word);
      case 13: // Enter
        hide_suggest_box();
        return;
      }
      return;
    }

    if (last_input_word != search_word) {
      last_input_word = search_word;
      selection = 0;

      if (last_search_word != search_word) {
        last_search_word = search_word;
        hide_suggest_box();
        suggest_words = find_suggest_words(search_word);
        if (0 == suggest_words.length) return;
        update_suggest_box(suggest_words);
      }

      show_suggest_box(search_word);
    }
  };

  function mouse_handler(event) {
    var target = $(event.target);
    if ('LI' == target[0].nodeName) {
      change_selection(target.prevAll().length + 1, true);
      if ('click' == event.type) {
        search_box.val(suggest_words[selection - 1]);
        search_box.closest('form').submit();
      }
    }
  };

}

})('undefined' != typeof unsafeWindow && unsafeWindow || window);
