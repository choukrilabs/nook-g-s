local $/ = undef;
my $file = 'src/i18n/translations.ts';
open my $fh, '<', $file or die $!;
my $content = <$fh>;
close $fh;

# Replace second occurrence (English)
$content =~ s/"pwa": \{\n        "title": "Installer Nook OS",\n        "desc": "Installez l'application pour un accès rapide et une expérience hors ligne.",\n        "install": "Installer"\n    \}/"pwa": {\n        "title": "Install Nook OS",\n        "desc": "Install the app for quick access and offline experience.",\n        "install": "Install"\n    }/;

# The above replaces the FIRST match only, so we need a clever way. Let's just sed replace by line numbers or use a simpler script.
