local $/ = undef;
my $file = 'src/i18n/translations.ts';
open my $fh, '<', $file or die $!;
my $content = <$fh>;
close $fh;

$content =~ s/"common": \{/"pwa": {\n        "title": "Installer Nook OS",\n        "desc": "Installez l'application pour un accès rapide et une expérience hors ligne.",\n        "install": "Installer"\n    },\n    "common": \{/g;

open $fh, '>', $file or die $!;
print $fh $content;
close $fh;
