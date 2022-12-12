import fetch from "node-fetch";
import { load } from "cheerio";
import { DynamoDBClient, ReturnValue } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, PutCommand } from "@aws-sdk/lib-dynamodb";
import { SESClient, SendTemplatedEmailCommand } from "@aws-sdk/client-ses";

const ddbClient = new DynamoDBClient({ region: "us-east-1" });
const ddbDocClient = DynamoDBDocumentClient.from(ddbClient);
const sesClient = new SESClient({ region: "us-east-1" });

// Returns {date, time, available}[]
const findAvailabilities = async url => {
    const response = await fetch(url, {
        headers: {
            'Cookie': '.AspNetCore.Antiforgery.qa0ZJhwo1l4=CfDJ8LyGPn3jL59Ao1rE4qp88-nhN2bKKMdSo4OQYOAXDQmTOKCOltTg7amsiHVL669769mw2JUKwl6yT3_qXxP3gPVfZ9BE4uA-nXNdUUkHvZoAhIgyTvn4NGctd-8TYKlM50kBFCLR-Mv3Qzb3mjMpjrA; ReserveTimeState=CfDJ8LyGPn3jL59Ao1rE4qp88-nTiSW8vBAKNiheQYR0AA1VDbST9_GyyEIxE70S0z1B_LeGPF--1Xc6HUCkz9bsLcke791-6dDh1wDBF2PGHbdSScj77QZxxuNfohs0Qi9_5iKDz07t-B9D_3RhYfz2s2T21JdKoQT1gZiDPBkm62KzrFrZCIDbvp3ogHDL9vQLbrVdl0KxnA59vqnLHJmXA7WNCIXgVW2sSf8wujJ_XRgG3OIaEDtHME5FdCkmdsCPma2WwS9HK9fJlIRouS-6MsrGTH6Xag-PlwVo6kAaM1-g26OHYgAD95dqlJkxvOP4Eqk-5ga-J7pxJnH7kkyOAcG2kZ5m0Q4GaelBq1artmuKoqpUkBQMAOLnpDbRVHtNMW4bVFb_kCvaf69QAufttcL0RzKRzD7MThHcgW_UTBXaiF5TOPGpBinX4U2PbsRpnQfXf9OTVs1QE5ukRlQNHsiVFuGVWO08pChzwFOMEA1Hn5WSXJwmVqxTrPifllzLE0Gor7ghbiJUsu5jfuXU-0WFTcFn8_N71-pPWyquqcB_7ygorJfJakPGZ74VhHutwpQDRf6kl8OBZfuImntT3UxoS92H1wB1sE4Un0aYg7ktBwCp9-LBQzA31CUtpHlpwPWV11iNVb8HaTnNGDqDoaviBiTbQogHRilfOxOfQMODkHQHmEJEdmrwROSBDrtmo8YExeunR1Fi1VjMzFHfGmclho-Ui62Xqe0TeK7oQkbOQD7qR7YNtCp8OPdQ8P0GobFlTWjHosNbr-JYtQrItF3llSGCWMACMddNXqvnTNM0oHNEO6mmYeddpw_Z0JlMwScM5E0OwL3ObjAa_25aNi9kixdBwusz5VYuwcCZxa6cJyOSAytqEI1c1dtrXY1dqWHxnRgzQbXrxAclFNMJKObrqtOkxRInoIKcMJ1sg1phzPXhMu9dpDF_fE3WOF-E1-0Fdx6WqpTlKQgQ84VHfQpi3I7vOO7COyA1Qk1e26eRiyXxlBZZdqfFOQpUy6cszPQZJbGPRA3DlBHmkh1Oc1rHwQDQwIJmLYksomW9VD8MyINZZU64uXUXOaWZWrwfCUjp81kG6LTO_13OFMyK2-CD3UPqsmyWLY49khb4S5_D',
            'Referer': 'https://reservation.frontdesksuite.ca/rcfs/richcraftkanata/Home/Index?Culture=en&PageId=b3b9b36f-8401-466d-b4c4-19eb5547b43a&ShouldStartReserveTimeFlow=False&ButtonId=00000000-0000-0000-0000-000000000000',
        },
    });
    const body = await response.text();

    const $ = load(body);
    const times = [];
    $("div .one-queue").each((i, dateElement) => {
        const date = $(".header-text", dateElement).text();

        $("li .time-container", dateElement).each((i, element) => {
            const time = $(element).text().trim();
            const available = $(element).attr("onclick").trim() !== "return false;";
            times.push({
                date,
                time,
                available,
            });
        });
    });

    return times;
}

// Returns true if availability changed from false/non-existent to true
const updateAvailability = async (centre, availability) => {
    const { date, time, available } = availability;
    const res = await ddbDocClient.send(new PutCommand({
        TableName: process.env.tableName || "badminton",
        Item: {
            centre,
            dateAndTime: `${date}/${time}`,
            available: available,
        },
        ReturnValues: ReturnValue.ALL_OLD,
    }));

    const prevAvailable = res.Attributes ? res.Attributes.available : null;

    return !prevAvailable && available;
    // return prevAvailable === false && available;
};

// Assumes all values in newAvailabilitiesByCentre have available=true
const sendEmail = async (newAvailabilitiesByCentre) => {
    if (!newAvailabilitiesByCentre) {
        console.log("sendEmail() error: no newAvailabilitiesByCentre", newAvailabilitiesByCentre);
        return;
    }

    const centresCsv = Object.keys(newAvailabilitiesByCentre).join(", ");
    const centres = Object.keys(newAvailabilitiesByCentre).map(centre => {
        const newAvailabilities = newAvailabilitiesByCentre[centre];
        const dateAndTimes = newAvailabilities.map(availability => {
            return { ulText: `${availability.date} at ${availability.time}` };
        });
        return {
            name: centre,
            dateAndTimes,
        }
    });
    const res = await sesClient.send(new SendTemplatedEmailCommand({
        Source: "Badminton Buddy <badminton@davidliao.ca>",
        Destination: {
            ToAddresses: ["badminton@davidliao.ca"],
        },
        Template: process.env.emailTemplateName || "badminton-availability-found",
        TemplateData: JSON.stringify({
            centresCsv,
            centres,
        }),
        ReturnPath: "badminton@davidliao.ca",
    }));
    return res.MessageId;
};

const main = async () => {
    const centres = {
        Richcraft: "https://reservation.frontdesksuite.ca/rcfs/richcraftkanata/ReserveTime/TimeSelection?pageId=b3b9b36f-8401-466d-b4c4-19eb5547b43a&buttonId=28f471f1-d18d-4343-8899-174482066d6c&culture=en",
        Cardelrec: "https://reservation.frontdesksuite.ca/rcfs/cardelrec/ReserveTime/TimeSelection?pageId=a10d1358-60a7-46b6-b5e9-5b990594b108&buttonId=11a063a7-331c-4409-937b-97efed25c1b9&culture=en",
        Hintonburg: "https://reservation.frontdesksuite.ca/rcfs/hintonburgcc/ReserveTime/TimeSelection?pageId=171093b3-dfc1-4193-b02c-bd8173675fd5&buttonId=22c27780-383b-411d-b06e-3fc4ae63e282&culture=en",
        Minto: "https://reservation.frontdesksuite.ca/rcfs/mintobarrhaven/ReserveTime/TimeSelection?pageId=69f7cf1e-4b39-4609-9cff-fe2deeb4c231&buttonId=aa574cf4-096d-4ac6-89ad-795871bddba3&culture=en",
        Nepean: "https://reservation.frontdesksuite.ca/rcfs/nepeansportsplex/ReserveTime/TimeSelection?culture=en&pageId=b0d362a1-ba36-42ae-b1e0-feefaf43fe4c&buttonId=9ce6512e-016d-4bef-8a73-461225acfb08",
    };

    const newAvailabilitiesByCentre = {};
    for (const centre in centres) {
        const availabilities = await findAvailabilities(centres[centre]);

        for (const availability of availabilities) {
            const transitionedToAvailable = await updateAvailability(centre, availability);
            if (transitionedToAvailable) {
                const newAvailabilities = newAvailabilitiesByCentre[centre] || [];
                newAvailabilities.push(availability);
                newAvailabilitiesByCentre[centre] = newAvailabilities;
            }
        }
    }

    if (Object.keys(newAvailabilitiesByCentre).length > 0) {
        const messageId = await sendEmail(newAvailabilitiesByCentre);
        console.log("Sent email, messageId", messageId);
    } else {
        console.log("No new availabilities");
    }
};

// Uncomment this and comment out handler for unit tests
// export { findAvailabilities, updateAvailability, sendEmail, main };

export const handler = async event => {
    await main();
};
