cat << 'INNER_EOF' > replacement.txt
  const generatePDF = async () => {
    if (!cafe) return

    const doc = new jsPDF()
    
    // Config
    const primaryColor: [number, number, number] = [249, 115, 22]; // #f97316
    const darkColor: [number, number, number] = [40, 40, 40];
    
    // Header
    doc.setFontSize(22)
    doc.text(cafe.name, 14, 20)
    doc.setFontSize(12)
    const periodLabel = period === 'today' ? t('common.today') : period === 'week' ? t('common.thisWeek') : t('common.thisMonth')
    doc.text(`Rapport d'activité - Période : ${periodLabel}`, 14, 30)
    doc.setFontSize(10)
    doc.setTextColor(100)
    doc.text(`Généré le ${format(new Date(), 'dd/MM/yyyy à HH:mm')}`, 14, 36)
    doc.setTextColor(0)

    // Summary Statistics
    doc.setFontSize(14)
    doc.text('1. Résumé Global', 14, 50)
    
    autoTable(doc, {
      startY: 55,
      head: [['Total Sessions', 'Revenu Total', 'Durée Moyenne (min)']],
      body: [
        [
          stats.count.toString(), 
          `${stats.revenue.toFixed(2)} DH`, 
          stats.avgDuration.toString()
        ]
      ],
      theme: 'grid',
      headStyles: { fillColor: primaryColor }
    })

    let finalY = (doc as any).lastAutoTable.finalY + 15

    // Breakdown tables
    doc.setFontSize(14)
    doc.text('2. Répartition par Catégorie', 14, finalY)

    autoTable(doc, {
      startY: finalY + 5,
      head: [['Boissons', 'Nourriture', 'Autres']],
      body: [
        [
          `${(categoryRevenue['boisson'] || 0).toFixed(2)} DH`,
          `${(categoryRevenue['nourriture'] || 0).toFixed(2)} DH`,
          `${(categoryRevenue['autre'] || 0).toFixed(2)} DH`
        ]
      ],
      theme: 'grid',
      headStyles: { fillColor: darkColor }
    })
    
    finalY = (doc as any).lastAutoTable.finalY + 15
    doc.setFontSize(14)
    doc.text('3. Répartition par Mode de Paiement', 14, finalY)

    autoTable(doc, {
      startY: finalY + 5,
      head: [['Espèces', 'Carte', 'Compte', 'Gratuit']],
      body: [
        [
          `${(stats.payments.cash || 0).toFixed(2)} DH`,
          `${(stats.payments.card || 0).toFixed(2)} DH`,
          `${(stats.payments.account || 0).toFixed(2)} DH`,
          `${(stats.payments.free || 0).toFixed(2)} DH`
        ]
      ],
      theme: 'grid',
      headStyles: { fillColor: darkColor }
    })

    finalY = (doc as any).lastAutoTable.finalY + 20

    // Visual Chart (drawn natively)
    if (finalY > doc.internal.pageSize.height - 80) {
      doc.addPage()
      finalY = 20
    }
    
    doc.setFontSize(14)
    doc.text('4. Évolution des Revenus', 14, finalY)
    
    if (chartData && chartData.length > 0) {
      const chartHeight = 50;
      const chartWidth = 180;
      const marginX = 14;
      
      const maxRev = Math.max(...chartData.map((d: any) => d.revenue), 10);
      const barWidth = Math.min((chartWidth - 20) / chartData.length, 12);
      const gap = ((chartWidth - 20) - (barWidth * chartData.length)) / (chartData.length + 1);
      
      doc.setDrawColor(200, 200, 200);
      doc.setLineWidth(0.5);
      doc.line(marginX, finalY + 5, marginX, finalY + 5 + chartHeight); // Y
      doc.line(marginX, finalY + 5 + chartHeight, marginX + chartWidth, finalY + 5 + chartHeight); // X
      
      doc.setFontSize(8);
      doc.setTextColor(120);
      doc.text(`${maxRev.toFixed(0)}`, marginX - 2, finalY + 8, { align: 'right' });
      doc.text(`${(maxRev/2).toFixed(0)}`, marginX - 2, finalY + 5 + (chartHeight/2), { align: 'right' });
      doc.text('0', marginX - 2, finalY + 5 + chartHeight, { align: 'right' });

      doc.setFillColor(primaryColor[0], primaryColor[1], primaryColor[2]);
      
      chartData.forEach((d: any, i: number) => {
        const x = marginX + gap + (i * (barWidth + gap));
        const barH = (d.revenue / maxRev) * chartHeight;
        const y = finalY + 5 + chartHeight - barH;
        
        if (barH > 0) {
          doc.rect(x, y, barWidth, barH, 'F');
        }
        
        doc.setFontSize(7);
        doc.setTextColor(100);
        const label = chartData.length > 15 ? d.date.split('/')[0] : d.date; 
        doc.text(label, x + (barWidth/2), finalY + 5 + chartHeight + 4, { align: 'center' });
      });
      
      finalY += chartHeight + 20;
    } else {
      doc.setFontSize(10);
      doc.setTextColor(150);
      doc.text('Aucune donnée disponible pour le graphique.', 14, finalY + 10);
      finalY += 20;
    }

    doc.setTextColor(0);

    // Session Details
    if (finalY > doc.internal.pageSize.height - 40) {
      doc.addPage()
      finalY = 20
    }
    
    doc.setFontSize(14)
    doc.text('5. Détails des Sessions', 14, finalY)

    const sessionData = sessions.map(s => [
      format(new Date(s.ended_at!), 'dd/MM/yyyy HH:mm'),
      s.customer_name || '-',
      s.seat_number?.toString() || '-',
      s.duration_minutes?.toString() || '0',
      `${s.total_amount.toFixed(2)} DH`,
      s.payment_method === 'cash' ? 'Espèces' : s.payment_method === 'card' ? 'Carte' : s.payment_method === 'account' ? 'Compte' : s.payment_method === 'free' ? 'Gratuit' : '-'
    ])

    autoTable(doc, {
      startY: finalY + 5,
      head: [['Date', 'Client', 'Place', 'Durée (min)', 'Montant', 'Mode de Paiement']],
      body: sessionData,
      theme: 'striped',
      headStyles: { fillColor: darkColor }
    })

    // Footer
    const pageCount = (doc as any).internal.getNumberOfPages()
    for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i)
        doc.setFontSize(9)
        doc.setTextColor(150)
        doc.text(
            `Page ${i} sur ${pageCount} - Généré par Nook OS`,
            doc.internal.pageSize.width / 2,
            doc.internal.pageSize.height - 10,
            { align: 'center' }
        )
    }

    doc.save(`Rapport_${cafe.name}_${period}.pdf`)
  }
INNER_EOF
