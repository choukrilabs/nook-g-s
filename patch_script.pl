local $/ = undef;
my $file = 'src/components/auth/StaffPinLogin.tsx';
open my $fh, '<', $file or die $!;
my $content = <$fh>;
close $fh;

$content =~ s/<div className="flex justify-between gap-1 sm:gap-2">.*?<\/div>/<div className="flex justify-center">\n              <input\n                type="text"\n                autoComplete="off"\n                maxLength={8}\n                placeholder="Ex: A1B2C3D4"\n                className="w-full h-14 bg-black\/25 border border-border rounded-lg text-center font-mono text-xl sm:text-2xl font-bold text-text focus:border-accent outline-none transition-colors uppercase"\n                value={inviteCode}\n                onChange={(e) => setInviteCode(e.target.value.toUpperCase().replace(\/[^A-Z0-9]\/g, "").slice(0, 8))}\n              \/>\n            <\/div>/s;

# We also need to change `inviteCode.length < 6` to `< 8`
$content =~ s/inviteCode\.length < 6/inviteCode.length < 8/g;
$content =~ s/inviteCode\.length === 6/inviteCode.length === 8/g;

open $fh, '>', $file or die $!;
print $fh $content;
close $fh;
