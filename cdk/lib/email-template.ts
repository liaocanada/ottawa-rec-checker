const subjectTemplate = "Badminton tix available: {{centresCsv}}";

const htmlBodyTemplate = `
<h2>BADMINTON TIX AVAILABLE!!!</h2>
New availabilitiesssssssss~~


{{#each centres}}
<h3><u>{{name}}<u></h3>

<ul>
{{#each dateAndTimes}}
<li>{{ulText}}</li>
{{/each}}
</ul>

<p><a href="{{url}}">book it</a></p>

{{/each}}
`;

export { subjectTemplate, htmlBodyTemplate };
