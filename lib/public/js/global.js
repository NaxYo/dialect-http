jQuery().busy('defaults', {img: '/images/busy.gif', hide: false});
jQuery().busy('preload');

$(function() {
  var current_locale = $('#current_locale').val(),
      base_locale = $('#base_locale').val(),

      getTextarea = function ($el) {
        return $el.parent().prev();
      },

      updateBars = function ($text_bar, total, ok, pending, missing) {
        var percent_ok = (ok / total) * 100,
            percent_pending = (pending / total) * 100,
            percent_missing = (missing / total) * 100;

        $text_bar.text(total + ' strings, ' + ok + ' translated, ' + pending + ' pending, ' + missing + ' missing');

        $('div.bars a').eq(0).css({width: percent_ok + '%'});
        $('div.bars a').eq(1).css({width: percent_pending + '%'});
        $('div.bars a').eq(2).css({width: percent_missing + '%'});
      },

      updateLastStatus = function ($textarea) {
        $textarea.data('last_status', $textarea.parent().attr('class').match(/ok|missing|pending/)[0]);
      },

      updateForm = function ($textarea) {
        var $form = $textarea.parent(),
            $text_bar = $('h1 .right'),
            parts = $text_bar.text().match(/[0-9]+/g),
            ok, pending, missing, total;

        total   = parts[0];
        ok      = parts[1];
        pending = parts[2];
        missing = parts[3];

        if ($textarea.data('last_status') === 'ok' || $textarea.data('last_status') === 'pending') {
          if ($textarea.val()) {
            if ($textarea.data('last_status') !== 'pending' && $form.hasClass('ok')) {
              pending++;
              ok--;
              $form.removeClass('ok').addClass('pending');
            }
          } else if ($textarea.data('last_status') !== 'missing') {
            missing++;
            if ($form.hasClass('ok')) {
              ok--;
              $form.removeClass('ok').addClass('missing');
            } else {
              pending--;
              $form.removeClass('pending').addClass('missing');
            }
          }
        } else {
          if ($textarea.data('last_status') !== 'pending' && $textarea.val()) {
            missing--;
            pending++;
            $form.removeClass('missing').addClass('pending');
          }
        }

        updateBars($text_bar, total, ok, pending, missing);
        updateLastStatus($textarea);
      },

      approve = function ($textarea, approve) {
        var $form = $textarea.parent(),
            $text_bar = $('h1 .right'),
            parts = $text_bar.text().match(/[0-9]+/g),
            ok, pending, missing, total;

        total   = parts[0];
        ok      = parts[1];
        pending = parts[2];
        missing = parts[3];

        $.ajax({
          type: 'POST',
          url: '/' + current_locale + '/approve/',
          data: {
            approved: approve,
            id: $textarea.siblings('input[name="id"]').val()
          },
          success: function() {
            $textarea.busy('hide');
          },
          dataType: 'text'
        });

        $textarea.busy({title: 'saving...'});

        if (approve) {
          pending--;
          ok++;
          $form.removeClass('pending').addClass('ok');
        } else {
          pending++;
          ok--;
          $form.removeClass('ok').addClass('pending');
        }

        updateBars($text_bar, total, ok, pending, missing);
        updateLastStatus($textarea);
      };

      deleteTranslation = function ($textarea, approve) {
        var $form = $textarea.parent(),
            $text_bar = $('h1 .right'),
            parts = $text_bar.text().match(/[0-9]+/g),
            ok, pending, missing, total;

        total   = parts[0];
        ok      = parts[1];
        pending = parts[2];
        missing = parts[3];

        $.ajax({
          type: 'POST',
          url: '/' + current_locale + '/delete/',
          data: {
            id: $textarea.siblings('input[name="id"]').val()
          },
          success: function() {
            $textarea.busy('hide');
            $form.remove();
          },
          dataType: 'text'
        });

        $textarea.busy({title: 'saving...'});

        total--;
        classes = $form.attr('class').split(' ');
        for (var i = 0; i<classes.length; i++) {
          if(classes[i] == 'ok')      { ok--;      break; }
          if(classes[i] == 'pending') { pending--; break; }
          if(classes[i] == 'missing') { missing--; break; }
        }

        updateBars($text_bar, total, ok, pending, missing);
        updateLastStatus($textarea);
      };

  setEvents($('#content .page'));

  $('button.copy-all').click(function(event) {
    $('button.copy').trigger('click');
  });

  $('button.approve-all').click(function(event) {
    $('a.approve').trigger('click');
  });

  var timeout;
  $('input.search').on('keyup', function(event) {
    var query = $(this).val();

    $('#content .results').busy(query ? {} : 'hide');
    $('#content .page').toggle(!query);

    timeout && clearTimeout(timeout);
    if(query) timeout = setTimeout(search, 800);
    else $('#content .results').empty();
  });

  function search() {
    var query = $('input.search').val();
    var isLongEnough = query.length > 3;

    isLongEnough || $('#content .results')
      .html('<p>Minimum search query length is 4 characters</p>')
      .busy('hide');

    isLongEnough && $.ajax({
      type    : 'POST',
      url     : '/' + current_locale + '/search/',
      data    : { query: query},
      success : onData
    });

    function onData(data) {
      var $results = $('#content .results');

      $results.html(data || '<p>No results</p>').busy('hide');
      setEvents($results);
      $results.find('form').each(function() {
        updateForm($(this));
      });
    }
  }

  function setEvents($container) {
    $container.find('textarea.translation')
      .each(function() {
        $(this).data('old_value', $(this).val());
        updateLastStatus($(this));
      })
      .keyup(function() {
        updateForm($(this));
      })
      .change(function() {
        var $textarea = $(this),
            old_value = $textarea.data('old_value'),
            new_value = $textarea.val();

        if (old_value !== new_value) {
          $.ajax({
            type: 'POST',
            url: '/' + current_locale + '/translate/',
            data: {
              translation: new_value,
              id: $textarea.siblings('input[name="id"]').val(),
              original: $textarea.siblings('input[name="original"]').val()
            },
            success: function() {
              $textarea.busy('hide');
            },
            dataType: 'text'
          });

          $textarea.busy({title: 'saving...'});
          updateForm($textarea);

          $textarea.data('old_value',  new_value);
        }
      });

    $container.find('a.clean').click(function() {
      var $textarea = getTextarea($(this));
      $textarea.val('').change();
      return false;
    });

    $container.find('a.get_original').click(function() {
      var $textarea = getTextarea($(this)),
          $original = $textarea.prev();

      $textarea.val($original.text()).change();
      return false;
    });

    $container.find('a.approve').click(function() {
      var $textarea = getTextarea($(this));
      approve($textarea, true);
      return false;
    });

    $container.find('a.reject').click(function() {
      var $textarea = getTextarea($(this));
      approve($textarea, false);
      return false;
    });

    $container.find('a.delete').click(function() {
      var $textarea = getTextarea($(this));
      deleteTranslation($textarea, false);
      return false;
    });

    $container.find('button.copy').click(function(event) {
      var $button = $(this);
      var $translation = $button.siblings('textarea.translation');

      event.preventDefault();

      var original = $button.siblings('.original').text();
      $translation.val(original).trigger('change');
    });
  }
});
