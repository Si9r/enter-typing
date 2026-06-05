async function saerchData() {
    const topic = document.getElementById("topic").Value;
    const keyword = document.getElementById("keyword").Value;

    const response = await fetch("http://127.0.0.1:8000/search",{

        method: "POST",

        headers: {
            "Content-Type": "application/json"
        },

        body: JSON.stringify({
            topic: topic,
            keyword: keyword
        })
    });

    const data = await response.json();

    document.getElementById("result").innerText = data.text;
}